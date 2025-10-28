/**
 * SQLite storage layer for code index
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type {
  FileRecord,
  SymbolRecord,
  CallRecord,
  ReferenceRecord,
  Location,
} from '../core/types.js';

export class CodeDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = dirname(dbPath);
    mkdirSync(dir, { recursive: true });
    
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        file_id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        language TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL,
        indexed_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
      CREATE INDEX IF NOT EXISTS idx_files_hash ON files(content_hash);

      CREATE TABLE IF NOT EXISTS symbols (
        symbol_id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        language TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        qualified_name TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        start_col INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        end_col INTEGER NOT NULL,
        signature TEXT,
        exported INTEGER DEFAULT 0,
        FOREIGN KEY (file_id) REFERENCES files(file_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_symbols_qualified ON symbols(qualified_name);
      CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
      CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);

      CREATE TABLE IF NOT EXISTS calls (
        call_id INTEGER PRIMARY KEY AUTOINCREMENT,
        caller_symbol_id INTEGER NOT NULL,
        callee_symbol_id INTEGER NOT NULL,
        site_file_id INTEGER NOT NULL,
        site_start_line INTEGER NOT NULL,
        site_start_col INTEGER NOT NULL,
        site_end_line INTEGER NOT NULL,
        site_end_col INTEGER NOT NULL,
        FOREIGN KEY (caller_symbol_id) REFERENCES symbols(symbol_id) ON DELETE CASCADE,
        FOREIGN KEY (callee_symbol_id) REFERENCES symbols(symbol_id) ON DELETE CASCADE,
        FOREIGN KEY (site_file_id) REFERENCES files(file_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_symbol_id);
      CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_symbol_id);

      CREATE TABLE IF NOT EXISTS symbol_references (
        ref_id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_file_id INTEGER NOT NULL,
        from_start_line INTEGER NOT NULL,
        from_start_col INTEGER NOT NULL,
        from_end_line INTEGER NOT NULL,
        from_end_col INTEGER NOT NULL,
        to_symbol_id INTEGER NOT NULL,
        ref_kind TEXT NOT NULL,
        FOREIGN KEY (from_file_id) REFERENCES files(file_id) ON DELETE CASCADE,
        FOREIGN KEY (to_symbol_id) REFERENCES symbols(symbol_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_refs_symbol ON symbol_references(to_symbol_id);
      CREATE INDEX IF NOT EXISTS idx_refs_file ON symbol_references(from_file_id);
    `);
  }

  // File operations
  insertFile(file: FileRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO files (path, language, content_hash, mtime, size)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        mtime = excluded.mtime,
        size = excluded.size,
        indexed_at = strftime('%s', 'now')
      RETURNING file_id
    `);
    const result = stmt.get(file.path, file.language, file.contentHash, file.mtime, file.size) as { file_id: number };
    return result.file_id;
  }

  getFileByPath(path: string): FileRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT file_id as fileId, path, language, content_hash as contentHash, mtime, size
      FROM files WHERE path = ?
    `);
    return stmt.get(path) as FileRecord | undefined;
  }

  deleteFile(fileId: number): void {
    this.db.prepare('DELETE FROM files WHERE file_id = ?').run(fileId);
  }

  // Symbol operations
  insertSymbol(symbol: SymbolRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO symbols (
        file_id, language, kind, name, qualified_name,
        start_line, start_col, end_line, end_col, signature, exported
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      symbol.fileId,
      symbol.language,
      symbol.kind,
      symbol.name,
      symbol.qualifiedName,
      symbol.startLine,
      symbol.startCol,
      symbol.endLine,
      symbol.endCol,
      symbol.signature || null,
      symbol.exported ? 1 : 0
    );
    return result.lastInsertRowid as number;
  }

  findSymbolsByName(name: string, language?: string): SymbolRecord[] {
    let query = `
      SELECT symbol_id as symbolId, file_id as fileId, language, kind, name,
             qualified_name as qualifiedName, start_line as startLine,
             start_col as startCol, end_line as endLine, end_col as endCol,
             signature, exported
      FROM symbols WHERE name = ?
    `;
    const params: any[] = [name];
    
    if (language) {
      query += ' AND language = ?';
      params.push(language);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as SymbolRecord[];
  }

  getAllSymbols(): SymbolRecord[] {
    const stmt = this.db.prepare(`
      SELECT symbol_id as symbolId, file_id as fileId, language, kind, name,
             qualified_name as qualifiedName, start_line as startLine,
             start_col as startCol, end_line as endLine, end_col as endCol,
             signature, exported
      FROM symbols
    `);
    return stmt.all() as SymbolRecord[];
  }

  getSymbolById(symbolId: number): SymbolRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT symbol_id as symbolId, file_id as fileId, language, kind, name,
             qualified_name as qualifiedName, start_line as startLine,
             start_col as startCol, end_line as endLine, end_col as endCol,
             signature, exported
      FROM symbols WHERE symbol_id = ?
    `);
    return stmt.get(symbolId) as SymbolRecord | undefined;
  }

  getSymbolsInFile(fileId: number): SymbolRecord[] {
    const stmt = this.db.prepare(`
      SELECT symbol_id as symbolId, file_id as fileId, language, kind, name,
             qualified_name as qualifiedName, start_line as startLine,
             start_col as startCol, end_line as endLine, end_col as endCol,
             signature, exported
      FROM symbols WHERE file_id = ?
    `);
    return stmt.all(fileId) as SymbolRecord[];
  }

  deleteSymbolsByFile(fileId: number): void {
    this.db.prepare('DELETE FROM symbols WHERE file_id = ?').run(fileId);
  }

  // Call operations
  insertCall(call: CallRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO calls (
        caller_symbol_id, callee_symbol_id, site_file_id,
        site_start_line, site_start_col, site_end_line, site_end_col
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      call.callerSymbolId,
      call.calleeSymbolId,
      call.siteFileId,
      call.siteStartLine,
      call.siteStartCol,
      call.siteEndLine,
      call.siteEndCol
    );
    return result.lastInsertRowid as number;
  }

  getCallsFrom(callerSymbolId: number): CallRecord[] {
    const stmt = this.db.prepare(`
      SELECT call_id as callId, caller_symbol_id as callerSymbolId,
             callee_symbol_id as calleeSymbolId, site_file_id as siteFileId,
             site_start_line as siteStartLine, site_start_col as siteStartCol,
             site_end_line as siteEndLine, site_end_col as siteEndCol
      FROM calls WHERE caller_symbol_id = ?
    `);
    return stmt.all(callerSymbolId) as CallRecord[];
  }

  getCallsTo(calleeSymbolId: number): CallRecord[] {
    const stmt = this.db.prepare(`
      SELECT call_id as callId, caller_symbol_id as callerSymbolId,
             callee_symbol_id as calleeSymbolId, site_file_id as siteFileId,
             site_start_line as siteStartLine, site_start_col as siteStartCol,
             site_end_line as siteEndLine, site_end_col as siteEndCol
      FROM calls WHERE callee_symbol_id = ?
    `);
    return stmt.all(calleeSymbolId) as CallRecord[];
  }

  deleteCallsByFile(fileId: number): void {
    this.db.prepare('DELETE FROM calls WHERE site_file_id = ?').run(fileId);
  }

  // Reference operations
  insertReference(ref: ReferenceRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO symbol_references (
        from_file_id, from_start_line, from_start_col,
        from_end_line, from_end_col, to_symbol_id, ref_kind
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      ref.fromFileId,
      ref.fromStartLine,
      ref.fromStartCol,
      ref.fromEndLine,
      ref.fromEndCol,
      ref.toSymbolId,
      ref.refKind
    );
    return result.lastInsertRowid as number;
  }

  getReferencesToSymbol(symbolId: number): ReferenceRecord[] {
    const stmt = this.db.prepare(`
      SELECT ref_id as refId, from_file_id as fromFileId,
             from_start_line as fromStartLine, from_start_col as fromStartCol,
             from_end_line as fromEndLine, from_end_col as fromEndCol,
             to_symbol_id as toSymbolId, ref_kind as refKind
      FROM symbol_references WHERE to_symbol_id = ?
    `);
    return stmt.all(symbolId) as ReferenceRecord[];
  }

  deleteReferencesByFile(fileId: number): void {
    this.db.prepare('DELETE FROM symbol_references WHERE from_file_id = ?').run(fileId);
  }

  // Location lookup
  getSymbolLocation(symbolId: number): Location | undefined {
    const stmt = this.db.prepare(`
      SELECT s.file_id as fileId, f.path, s.start_line as startLine,
             s.start_col as startCol, s.end_line as endLine, s.end_col as endCol
      FROM symbols s
      JOIN files f ON s.file_id = f.file_id
      WHERE s.symbol_id = ?
    `);
    return stmt.get(symbolId) as Location | undefined;
  }

  // Transaction support
  beginTransaction(): void {
    this.db.prepare('BEGIN').run();
  }

  commit(): void {
    this.db.prepare('COMMIT').run();
  }

  rollback(): void {
    this.db.prepare('ROLLBACK').run();
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * Clear all data from the database (rebuild index)
   */
  clearAll(): void {
    this.db.transaction(() => {
      this.db.exec(`
        DELETE FROM symbol_references;
        DELETE FROM calls;
        DELETE FROM symbols;
        DELETE FROM files;
      `);
    })();
  }

  /**
   * Vacuum the database to reclaim space
   */
  vacuum(): void {
    this.db.exec('VACUUM');
  }

  close(): void {
    this.db.close();
  }
}

