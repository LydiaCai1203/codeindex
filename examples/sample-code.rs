// Sample Rust code for testing the code indexer

// Module declaration
mod example;

// Use statements
use std::collections::HashMap;

// Constants
const MAX_USERS: usize = 1000;
const DEFAULT_PAGE_SIZE: usize = 20;

// Static variables
static GLOBAL_SERVICE: Option<UserService> = None;
static mut DEBUG_MODE: bool = false;

// User struct
pub struct User {
    pub id: u32,
    pub name: String,
    pub email: String,
    pub is_active: bool,
}

// UserService struct
pub struct UserService {
    users: HashMap<u32, User>,
}

// Implementation block for User
impl User {
    // Associated function (constructor)
    pub fn new(id: u32, name: String, email: String) -> Self {
        User {
            id,
            name,
            email,
            is_active: true,
        }
    }

    // Method
    pub fn activate(&mut self) {
        self.is_active = true;
    }

    // Method
    pub fn deactivate(&mut self) {
        self.is_active = false;
    }

    // Method that calls another function
    pub fn is_valid(&self) -> bool {
        validate_email(&self.email) && !self.name.is_empty()
    }

    // Method that calls another method
    pub fn format_name(&self) -> String {
        format_user_name(&self.name)
    }
}

// Implementation block for UserService
impl UserService {
    // Associated function (constructor)
    pub fn new() -> Self {
        UserService {
            users: HashMap::new(),
        }
    }

    // Method
    pub fn add_user(&mut self, user: User) -> Result<(), String> {
        if self.users.contains_key(&user.id) {
            return Err(format!("User {} already exists", user.id));
        }
        self.users.insert(user.id, user);
        Ok(())
    }

    // Method
    pub fn get_user(&self, id: u32) -> Option<&User> {
        self.users.get(&id)
    }

    // Method
    pub fn update_user(&mut self, user: User) -> Result<(), String> {
        if !self.users.contains_key(&user.id) {
            return Err(format!("User {} not found", user.id));
        }
        self.users.insert(user.id, user);
        Ok(())
    }

    // Method
    pub fn delete_user(&mut self, id: u32) -> Result<(), String> {
        self.users.remove(&id).map(|_| ()).ok_or_else(|| format!("User {} not found", id))
    }

    // Method that calls another method
    pub fn list_active_users(&self) -> Vec<&User> {
        self.users.values().filter(|user| user.is_active).collect()
    }

    // Method that calls another function
    pub fn get_user_by_email(&self, email: &str) -> Option<&User> {
        self.users.values().find(|user| user.email == email)
    }
}

// Standalone function
pub fn validate_email(email: &str) -> bool {
    email.contains('@') && email.contains('.')
}

// Standalone function
pub fn format_user_name(name: &str) -> String {
    name.trim().to_uppercase()
}

// Standalone function that calls other functions
pub fn create_user(id: u32, name: String, email: String) -> Result<User, String> {
    if !validate_email(&email) {
        return Err(format!("Invalid email: {}", email));
    }

    let formatted_name = format_user_name(&name);

    Ok(User {
        id,
        name: formatted_name,
        email,
        is_active: true,
    })
}

// Standalone function that calls methods
pub fn process_users(service: &mut UserService, users: Vec<User>) -> Result<(), String> {
    for user in users {
        service.add_user(user)?;
    }
    Ok(())
}

// Enum example
pub enum UserRole {
    Admin,
    User,
    Guest,
}

// Enum with associated data
pub enum UserStatus {
    Active,
    Inactive,
    Suspended { reason: String },
}

// Trait definition
pub trait Validator {
    fn validate(&self) -> Result<(), String>;
}

// Trait implementation for User
impl Validator for User {
    fn validate(&self) -> Result<(), String> {
        if self.name.is_empty() {
            return Err("Name cannot be empty".to_string());
        }
        if !validate_email(&self.email) {
            return Err("Invalid email".to_string());
        }
        Ok(())
    }
}

// Generic function
pub fn find_user_by<T, F>(users: &[User], predicate: F) -> Option<&User>
where
    F: Fn(&User) -> Option<T>,
{
    users.iter().find_map(predicate)
}

// Function that uses the generic function
pub fn find_user_by_id(users: &[User], id: u32) -> Option<&User> {
    find_user_by(users, |user| if user.id == id { Some(user) } else { None })
}

// Point struct for testing
pub struct Point {
    pub x: f64,
    pub y: f64,
}

// Implementation for Point
impl Point {
    pub fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }

    pub fn distance(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
}

// Main function
pub fn main() {
    let mut service = UserService::new();

    let user1 = create_user(1, "John Doe".to_string(), "john@example.com".to_string()).unwrap();
    let user2 = create_user(2, "Jane Smith".to_string(), "jane@example.com".to_string()).unwrap();

    service.add_user(user1).unwrap();
    service.add_user(user2).unwrap();

    let active_users = service.list_active_users();
    println!("Active users: {}", active_users.len());
}

