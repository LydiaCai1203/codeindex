/**
 * Sample TypeScript code for testing the code indexer
 */

// Simple function
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Function calling another function
export function greetUser(userId: number): string {
  const name = getUserName(userId);
  return greet(name);
}

function getUserName(id: number): string {
  return `User${id}`;
}

// Class with methods
export class Calculator {
  private result: number = 0;

  add(value: number): this {
    this.result += value;
    return this;
  }

  subtract(value: number): this {
    this.result -= value;
    return this;
  }

  multiply(value: number): this {
    this.result = this.performMultiplication(this.result, value);
    return this;
  }

  private performMultiplication(a: number, b: number): number {
    return a * b;
  }

  getResult(): number {
    return this.result;
  }

  reset(): void {
    this.result = 0;
  }
}

// Using the calculator
export function calculateSum(numbers: number[]): number {
  const calc = new Calculator();
  
  for (const num of numbers) {
    calc.add(num);
  }
  
  return calc.getResult();
}

// Interface
export interface User {
  id: number;
  name: string;
  email: string;
}

// Type alias
export type UserId = number;

// Function using interface
export function createUser(id: UserId, name: string, email: string): User {
  return { id, name, email };
}

// Async function with calls
export async function fetchAndGreet(userId: number): Promise<string> {
  const user = await fetchUser(userId);
  return greet(user.name);
}

async function fetchUser(id: number): Promise<User> {
  // Simulated async operation
  return createUser(id, getUserName(id), `user${id}@example.com`);
}

