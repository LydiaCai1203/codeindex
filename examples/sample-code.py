"""
Sample Python code for testing the code indexer
"""

from typing import List, Optional, Dict
import json


# Constants
MAX_USERS = 1000
DEFAULT_PAGE_SIZE = 20


# Module-level variables
_global_cache = {}
debug_mode = False


class User:
    """Represents a user in the system"""
    
    def __init__(self, user_id: int, name: str, email: str):
        self.id = user_id
        self.name = name
        self.email = email
        self.is_active = True
    
    def __str__(self) -> str:
        return f"User({self.id}, {self.name}, {self.email})"
    
    def __repr__(self) -> str:
        return self.__str__()
    
    def activate(self) -> None:
        """Activate the user"""
        self.is_active = True
    
    def deactivate(self) -> None:
        """Deactivate the user"""
        self.is_active = False
    
    @property
    def is_valid(self) -> bool:
        """Check if user is valid"""
        return validate_email(self.email) and len(self.name) > 0
    
    def to_dict(self) -> Dict:
        """Convert user to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'is_active': self.is_active
        }
    
    @staticmethod
    def from_dict(data: Dict) -> 'User':
        """Create user from dictionary"""
        return User(data['id'], data['name'], data['email'])


class UserService:
    """Service for managing users"""
    
    def __init__(self):
        self._users: Dict[int, User] = {}
    
    def add_user(self, user: User) -> None:
        """Add a new user"""
        if user is None:
            raise ValueError("User cannot be None")
        self._users[user.id] = user
    
    def get_user(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return self._users.get(user_id)
    
    def update_user(self, user: User) -> None:
        """Update an existing user"""
        if user.id not in self._users:
            raise ValueError(f"User not found: {user.id}")
        self._users[user.id] = user
    
    def delete_user(self, user_id: int) -> None:
        """Delete a user"""
        if user_id in self._users:
            del self._users[user_id]
    
    def list_active_users(self) -> List[User]:
        """Get all active users"""
        return [user for user in self._users.values() if user.is_active]
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Find user by email"""
        for user in self._users.values():
            if user.email == email:
                return user
        return None
    
    def count_users(self) -> int:
        """Count total users"""
        return len(self._users)


def validate_email(email: str) -> bool:
    """Validate an email address"""
    return '@' in email and '.' in email


def format_user_name(name: str) -> str:
    """Format a user's name"""
    return name.strip().title()


def create_user(user_id: int, name: str, email: str) -> User:
    """Create a new user with validated data"""
    if not validate_email(email):
        raise ValueError(f"Invalid email: {email}")
    
    formatted_name = format_user_name(name)
    user = User(user_id, formatted_name, email)
    
    return user


def process_users(service: UserService, users: List[User]) -> None:
    """Process a batch of users"""
    for user in users:
        service.add_user(user)


def save_users_to_file(service: UserService, filename: str) -> None:
    """Save users to a JSON file"""
    users = service.list_active_users()
    data = [user.to_dict() for user in users]
    
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)


def load_users_from_file(filename: str) -> List[User]:
    """Load users from a JSON file"""
    with open(filename, 'r') as f:
        data = json.load(f)
    
    return [User.from_dict(item) for item in data]


class UserRepository:
    """Repository for user persistence"""
    
    def __init__(self, service: UserService):
        self.service = service
        self._cache = {}
    
    def save(self, user: User) -> None:
        """Save user"""
        self.service.add_user(user)
        self._cache[user.id] = user
    
    def find_by_id(self, user_id: int) -> Optional[User]:
        """Find user by ID"""
        if user_id in self._cache:
            return self._cache[user_id]
        
        user = self.service.get_user(user_id)
        if user:
            self._cache[user_id] = user
        return user
    
    def find_all(self) -> List[User]:
        """Find all users"""
        return self.service.list_active_users()


class AdminUser(User):
    """Admin user with additional privileges"""
    
    def __init__(self, user_id: int, name: str, email: str, role: str = "admin"):
        super().__init__(user_id, name, email)
        self.role = role
    
    def grant_permission(self, permission: str) -> None:
        """Grant a permission to the admin"""
        print(f"Granting {permission} to {self.name}")
    
    def revoke_permission(self, permission: str) -> None:
        """Revoke a permission from the admin"""
        print(f"Revoking {permission} from {self.name}")


def create_admin_user(user_id: int, name: str, email: str) -> AdminUser:
    """Create a new admin user"""
    user = create_user(user_id, name, email)
    return AdminUser(user.id, user.name, user.email)


# Decorator example
def log_calls(func):
    """Decorator to log function calls"""
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        result = func(*args, **kwargs)
        print(f"Finished {func.__name__}")
        return result
    return wrapper


@log_calls
def process_user_batch(users: List[User]) -> int:
    """Process a batch of users with logging"""
    service = UserService()
    process_users(service, users)
    return service.count_users()


# Context manager example
class UserSession:
    """Context manager for user sessions"""
    
    def __init__(self, user: User):
        self.user = user
    
    def __enter__(self):
        print(f"Starting session for {self.user.name}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Ending session for {self.user.name}")
        return False


def main():
    """Main entry point"""
    service = UserService()
    
    # Create some users
    user1 = create_user(1, "john doe", "john@example.com")
    user2 = create_user(2, "jane smith", "jane@example.com")
    
    # Add users to service
    service.add_user(user1)
    service.add_user(user2)
    
    # List active users
    active = service.list_active_users()
    print(f"Active users: {len(active)}")
    
    # Create admin
    admin = create_admin_user(3, "admin user", "admin@example.com")
    service.add_user(admin)


if __name__ == "__main__":
    main()

