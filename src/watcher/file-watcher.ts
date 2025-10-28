/**
 * File watcher for real-time file system monitoring
 */

import chokidar, { type FSWatcher } from 'chokidar';
import { Indexer } from '../indexer/indexer.js';
import { CodeDatabase } from '../storage/database.js';
import { resolve, relative } from 'path';

export interface WatchOptions {
  rootDir: string;
  include?: string[];
  exclude?: string[];
  debounceMs?: number; // 防抖延迟，默认 500ms
  batchIntervalMs?: number; // 批量索引间隔（毫秒），默认 10 分钟
  minChangeLines?: number; // 最小变更行数才触发索引，默认 0（每次都索引）
  onFileChange?: (path: string, event: 'add' | 'change' | 'unlink') => void;
  onError?: (error: Error) => void;
}

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private isClosed = false;
  private pendingIndexQueue = new Set<string>(); // 待索引文件队列
  private batchTimer: NodeJS.Timeout | null = null;
  private fileStats = new Map<string, { mtime: number; size: number; lines?: number }>(); // 文件状态缓存

  constructor(
    private indexer: Indexer,
    private db: CodeDatabase,
    private options: WatchOptions
  ) {}

  /**
   * Start watching files
   */
  start(): void {
    if (this.watcher) {
      return;
    }

    this.isClosed = false;
    const {
      rootDir,
      include = ['**/*'],
      exclude = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      debounceMs = 500, // 默认值，会被配置文件或 CLI 参数覆盖
      batchIntervalMs = 10 * 60 * 1000, // 默认 10 分钟，会被配置文件或 CLI 参数覆盖
      minChangeLines = 0, // 默认不限制变更行数，会被配置文件或 CLI 参数覆盖
      onFileChange,
      onError,
    } = this.options;
    
    // 保存这些值以便在回调中使用（这些值来自配置或 CLI 参数）
    const batchIntervalMsValue = batchIntervalMs;
    const minChangeLinesValue = minChangeLines;

    // 创建监听器（使用 glob 模式，chokidar 会在 rootDir 下查找）
    console.log(`[Watcher] Setting up watcher...`);
    console.log(`[Watcher] Root dir: ${rootDir}`);
    console.log(`[Watcher] Include patterns: ${JSON.stringify(include)}`);
    console.log(`[Watcher] Exclude patterns: ${JSON.stringify(exclude)}`);
    
    // 确保 rootDir 是绝对路径
    const absoluteRootDir = resolve(rootDir);
    console.log(`[Watcher] Absolute root dir: ${absoluteRootDir}`);
    
    // 对于深层目录，使用目录监听 + 文件过滤可能更可靠
    // 如果 include 模式是 **/*.go，直接监听整个目录树
    const watchPatterns = include.length === 1 && include[0] === '**/*.go' 
      ? [absoluteRootDir] // 监听整个目录
      : include.map(pattern => {
          // 如果是 **/*.go 这样的模式，转换为目录路径
          if (pattern.startsWith('**/')) {
            return absoluteRootDir;
          }
          return pattern;
        });
    
    console.log(`[Watcher] Watch patterns: ${JSON.stringify(watchPatterns)}`);
    
    this.watcher = chokidar.watch(watchPatterns, {
      ignored: exclude,
      persistent: true,
      ignoreInitial: true, // 忽略初始扫描，只监听后续变更
      awaitWriteFinish: {
        stabilityThreshold: debounceMs,
        pollInterval: 100,
      },
      cwd: absoluteRootDir,
      alwaysStat: false,
      usePolling: false, // 优先使用文件系统事件，如果失败会自动降级到轮询
      depth: 99, // 监听深层目录
    });
    
    // 添加调试：监听所有事件（包括系统级事件）
    this.watcher.on('all', (event, path) => {
      // 记录所有事件，除了 addDir（太频繁）
      if (event !== 'addDir') {
        console.log(`[Watcher] 🔍 Raw event: ${event} - ${path}`);
      }
    });
    
    // 注意：chokidar 可能不支持 unwatch 事件，已移除

    // 文件新增事件
    this.watcher.on('add', (filePath: string) => {
      if (this.isClosed) return;
      // 检查文件是否匹配 include 模式
      if (!this.matchesIncludePattern(filePath, include, absoluteRootDir)) {
        return;
      }
      const relativePath = this.normalizePath(filePath, rootDir);
      console.log(`[Watcher] 📄 File added: ${relativePath}`);
      this.debounceIndex(relativePath, 'add', debounceMs, onFileChange);
    });

    // 文件变更事件
    this.watcher.on('change', (filePath: string) => {
      if (this.isClosed) return;
      // 检查文件是否匹配 include 模式
      if (!this.matchesIncludePattern(filePath, include, absoluteRootDir)) {
        return;
      }
      const relativePath = this.normalizePath(filePath, rootDir);
      console.log(`[Watcher] ✏️  File changed: ${relativePath}`);
      this.debounceIndex(relativePath, 'change', debounceMs, onFileChange);
    });

    // 文件删除事件
    this.watcher.on('unlink', (filePath: string) => {
      if (this.isClosed) return;
      const relativePath = this.normalizePath(filePath, rootDir);
      console.log(`[Watcher] 🗑️  File deleted: ${relativePath}`);
      this.handleFileDelete(relativePath);
      onFileChange?.(relativePath, 'unlink');
    });

    // 目录删除事件
    this.watcher.on('unlinkDir', (dirPath: string) => {
      if (this.isClosed) return;
      const relativePath = this.normalizePath(dirPath, rootDir);
      console.log(`[Watcher] 📁 Directory deleted: ${relativePath}`);
      this.handleDirectoryDelete(relativePath);
    });

    // 错误处理
    this.watcher.on('error', (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      console.error('[Watcher] Error:', err.message);
    });

    // 准备就绪
    this.watcher.on('ready', () => {
      const batchIntervalMinutes = batchIntervalMsValue / 1000 / 60;
      console.log('[Watcher] 👀 Watching for file changes...');
      console.log(`[Watcher] 📂 Root directory: ${rootDir}`);
      console.log(`[Watcher] 📝 Include patterns: ${include.join(', ')}`);
      console.log(`[Watcher] 🚫 Exclude patterns: ${exclude.join(', ')}`);
      console.log(`[Watcher] ⏰ Batch interval: ${batchIntervalMinutes} minutes`);
      console.log(`[Watcher] 📊 Min change lines: ${minChangeLinesValue}`);
    });
  }

  /**
   * Stop watching files
   */
  stop(): void {
    if (this.watcher) {
      this.isClosed = true;
      this.watcher.close();
      this.watcher = null;
      
      // 清理所有防抖定时器
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();
      
      // 清理批量索引定时器
      if (this.batchTimer) {
        clearInterval(this.batchTimer);
        this.batchTimer = null;
      }
      
      // 处理队列中剩余的文件
      this.processPendingIndexQueue();
    }
  }

  /**
   * 防抖处理文件索引（添加到队列，不立即索引）
   */
  private debounceIndex(
    filePath: string,
    event: 'add' | 'change',
    delayMs: number,
    onFileChange?: (path: string, event: 'add' | 'change' | 'unlink') => void
  ): void {
    // 清除之前的定时器
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置新的定时器（只用于防抖，不立即索引）
    const timer = setTimeout(async () => {
      try {
        const absolutePath = resolve(this.options.rootDir, filePath);
        
        // 检查变更行数
        const shouldIndex = await this.shouldIndexFile(absolutePath, filePath);
        if (!shouldIndex) {
          console.log(`[Watcher] ⏭️  Skipped (minimal changes): ${filePath}`);
          return;
        }

        // 添加到待索引队列
        this.pendingIndexQueue.add(filePath);
        console.log(`[Watcher] 📋 Queued for indexing: ${filePath} (queue size: ${this.pendingIndexQueue.size})`);
        
        // 触发批量索引定时器
        this.scheduleBatchIndex();
        
        onFileChange?.(filePath, event);
      } catch (error) {
        console.error(`[Watcher] ❌ Failed to queue ${filePath}:`, error instanceof Error ? error.message : String(error));
      } finally {
        this.debounceTimers.delete(filePath);
      }
    }, delayMs);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * 检查文件是否应该被索引（基于变更行数）
   */
  private async shouldIndexFile(absolutePath: string, relativePath: string): Promise<boolean> {
    // 从 options 中获取最小变更行数（已从配置文件或 CLI 参数设置）
    const { minChangeLines = 0 } = this.options;
    
    // 如果没有设置最小变更行数，总是索引
    if (minChangeLines === 0) {
      return true;
    }

    try {
      const { readFileSync, statSync } = await import('fs');
      const stats = statSync(absolutePath);
      const oldStats = this.fileStats.get(relativePath);
      
      // 如果是新文件，总是索引
      if (!oldStats) {
        // 保存文件状态
        const content = readFileSync(absolutePath, 'utf-8');
        const lines = content.split('\n').length;
        this.fileStats.set(relativePath, {
          mtime: stats.mtimeMs,
          size: stats.size,
          lines,
        });
        return true;
      }

      // 检查文件是否真的改变了
      if (stats.mtimeMs === oldStats.mtime) {
        return false;
      }

      // 计算变更行数（简单估算：基于文件大小变化）
      const content = readFileSync(absolutePath, 'utf-8');
      const newLines = content.split('\n').length;
      const oldLines = oldStats.lines || 0;
      const lineDiff = Math.abs(newLines - oldLines);

      // 更新文件状态
      this.fileStats.set(relativePath, {
        mtime: stats.mtimeMs,
        size: stats.size,
        lines: newLines,
      });

      // 如果变更行数超过阈值，返回 true
      if (lineDiff >= minChangeLines) {
        console.log(`[Watcher] 📊 Change detected: ${lineDiff} lines changed in ${relativePath}`);
        return true;
      }

      return false;
    } catch (error) {
      // 如果读取失败，默认索引
      console.warn(`[Watcher] ⚠️  Could not check file stats for ${relativePath}:`, error);
      return true;
    }
  }

  /**
   * 安排批量索引
   */
  private scheduleBatchIndex(): void {
    // 从 options 中获取批量索引间隔（已从配置文件或 CLI 参数设置）
    const { batchIntervalMs = 10 * 60 * 1000 } = this.options;

    // 如果已经有定时器在运行，不重复创建
    if (this.batchTimer) {
      return;
    }

    // 设置定时器，在指定时间后处理队列
    this.batchTimer = setTimeout(() => {
      this.processPendingIndexQueue();
      this.batchTimer = null;
    }, batchIntervalMs);

    console.log(`[Watcher] ⏰ Batch index scheduled in ${batchIntervalMs / 1000}s`);
  }

  /**
   * 处理待索引队列
   */
  private async processPendingIndexQueue(): Promise<void> {
    if (this.pendingIndexQueue.size === 0) {
      return;
    }

    const filesToIndex = Array.from(this.pendingIndexQueue);
    this.pendingIndexQueue.clear();

    console.log(`[Watcher] 🔄 Processing batch index (${filesToIndex.length} files)...`);

    for (const filePath of filesToIndex) {
      try {
        const absolutePath = resolve(this.options.rootDir, filePath);
        console.log(`[Watcher] 🔄 Indexing: ${filePath}`);
        await this.indexer.indexFile(absolutePath);
        console.log(`[Watcher] ✅ Indexed: ${filePath}`);
      } catch (error) {
        console.error(`[Watcher] ❌ Failed to index ${filePath}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log(`[Watcher] ✅ Batch index complete (${filesToIndex.length} files)`);
  }

  /**
   * 处理文件删除
   */
  private handleFileDelete(filePath: string): void {
    try {
      const file = this.db.getFileByPath(filePath);
      if (file && file.fileId) {
        // 删除文件相关的所有数据（级联删除会处理 symbols, calls, references, embeddings）
        this.db.deleteFile(file.fileId);
        console.log(`[Watcher] ✅ Removed from index: ${filePath}`);
      } else {
        console.log(`[Watcher] ℹ️  File not in index: ${filePath}`);
      }
    } catch (error) {
      console.error(`[Watcher] ❌ Failed to delete file ${filePath}:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 处理目录删除
   */
  private handleDirectoryDelete(dirPath: string): void {
    try {
      // 查找所有在该目录下的文件
      const allFiles = this.db.getAllFiles();
      const filesToDelete = allFiles.filter(file => 
        file.path.startsWith(dirPath + '/') || file.path === dirPath
      );

      for (const file of filesToDelete) {
        if (file.fileId) {
          this.db.deleteFile(file.fileId);
        }
      }

      if (filesToDelete.length > 0) {
        console.log(`[Watcher] ✅ Removed directory from index: ${dirPath} (${filesToDelete.length} files)`);
      }
    } catch (error) {
      console.error(`[Watcher] Failed to delete directory ${dirPath}:`, error);
    }
  }

  /**
   * 规范化路径（相对于 rootDir）
   * chokidar 返回的路径已经是相对于 cwd 的，但可能需要进一步处理
   */
  private normalizePath(filePath: string, rootDir: string): string {
    // 如果路径是绝对路径，转换为相对路径
    const absPath = resolve(filePath);
    const absRoot = resolve(rootDir);
    if (absPath.startsWith(absRoot)) {
      return relative(absRoot, absPath);
    }
    // 已经是相对路径，直接返回
    return filePath.replace(/\\/g, '/'); // 统一使用正斜杠
  }

  /**
   * 检查文件路径是否匹配 include 模式
   * 支持各种 glob 模式，如 glob 模式（如双星号加斜杠加扩展名等）
   */
  private matchesIncludePattern(filePath: string, include: string[], rootDir: string): boolean {
    const relativePath = this.normalizePath(filePath, rootDir);
    
    for (const pattern of include) {
      // 将 glob 模式转换为正则表达式
      let regexPattern = pattern;
      
      // 转义特殊字符（除了 * 和 ?）
      // 需要逐个转义特殊字符，避免在字符类中的转义问题
      const specialChars = ['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'];
      for (const char of specialChars) {
        regexPattern = regexPattern.split(char).join('\\' + char);
      }
      
      // 将 ** 替换为匹配任意路径（包括斜杠）
      regexPattern = regexPattern.replace(/\*\*/g, '.*');
      
      // 将 * 替换为匹配除斜杠外的任意字符
      regexPattern = regexPattern.replace(/\*/g, '[^/]*');
      
      // 将 ? 替换为匹配除斜杠外的单个字符
      regexPattern = regexPattern.replace(/\?/g, '[^/]');
      
      // 添加开始和结束锚点
      const regex = new RegExp('^' + regexPattern + '$');
      
      if (regex.test(relativePath)) {
        return true;
      }
      
      // 如果模式以 / 开头，也尝试匹配去掉前导 / 的路径
      if (pattern.startsWith('/') && regex.test(relativePath)) {
        return true;
      }
    }
    
    return false;
  }
}

