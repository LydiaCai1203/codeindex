// Sample Java code for testing the code indexer

package com.example;

import java.util.*;

// User class
public class User {
    private int id;
    private String name;
    private String email;
    private boolean isActive;

    // Constructor
    public User(int id, String name, String email) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.isActive = true;
    }

    // Getter methods
    public int getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public boolean isActive() {
        return isActive;
    }

    // Setter methods
    public void setId(int id) {
        this.id = id;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setActive(boolean active) {
        isActive = active;
    }

    // Method that calls another method
    public void activate() {
        this.isActive = true;
    }

    public void deactivate() {
        this.isActive = false;
    }

    // Method that calls another function
    public boolean isValid() {
        return UserService.validateEmail(this.email) && !this.name.isEmpty();
    }

    // Method that calls another method
    public String formatName() {
        return UserService.formatUserName(this.name);
    }

    @Override
    public String toString() {
        return "User{id=" + id + ", name='" + name + "', email='" + email + "'}";
    }
}

// UserService class
public class UserService {
    private Map<Integer, User> users;

    // Constructor
    public UserService() {
        this.users = new HashMap<>();
    }

    // Method that calls another method
    public void addUser(User user) throws IllegalArgumentException {
        if (user == null) {
            throw new IllegalArgumentException("User cannot be null");
        }
        if (users.containsKey(user.getId())) {
            throw new IllegalArgumentException("User already exists: " + user.getId());
        }
        users.put(user.getId(), user);
    }

    // Method
    public User getUser(int id) {
        return users.get(id);
    }

    // Method
    public void updateUser(User user) throws IllegalArgumentException {
        if (!users.containsKey(user.getId())) {
            throw new IllegalArgumentException("User not found: " + user.getId());
        }
        users.put(user.getId(), user);
    }

    // Method
    public void deleteUser(int id) throws IllegalArgumentException {
        User removed = users.remove(id);
        if (removed == null) {
            throw new IllegalArgumentException("User not found: " + id);
        }
    }

    // Method that calls another method
    public List<User> listActiveUsers() {
        List<User> activeUsers = new ArrayList<>();
        for (User user : users.values()) {
            if (user.isActive()) {
                activeUsers.add(user);
            }
        }
        return activeUsers;
    }

    // Method that calls another function
    public User getUserByEmail(String email) {
        for (User user : users.values()) {
            if (user.getEmail().equals(email)) {
                return user;
            }
        }
        return null;
    }

    // Static method
    public static boolean validateEmail(String email) {
        return email != null && email.contains("@") && email.contains(".");
    }

    // Static method
    public static String formatUserName(String name) {
        return name != null ? name.trim().toUpperCase() : "";
    }

    // Method that calls other methods
    public static User createUser(int id, String name, String email) throws IllegalArgumentException {
        if (!validateEmail(email)) {
            throw new IllegalArgumentException("Invalid email: " + email);
        }

        String formattedName = formatUserName(name);

        return new User(id, formattedName, email);
    }

    // Method that calls other methods
    public static void processUsers(UserService service, List<User> users) throws IllegalArgumentException {
        for (User user : users) {
            service.addUser(user);
        }
    }
}

// Interface example
public interface Validator {
    boolean validate();
}

// Implementation of interface
public class UserValidator implements Validator {
    private User user;

    public UserValidator(User user) {
        this.user = user;
    }

    @Override
    public boolean validate() {
        if (user.getName() == null || user.getName().isEmpty()) {
            return false;
        }
        return UserService.validateEmail(user.getEmail());
    }
}

// Enum example
public enum UserRole {
    ADMIN,
    USER,
    GUEST
}

// Enum with constructor
public enum UserStatus {
    ACTIVE("Active"),
    INACTIVE("Inactive"),
    SUSPENDED("Suspended");

    private final String description;

    UserStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}

// Abstract class
public abstract class BaseService {
    protected String name;

    public BaseService(String name) {
        this.name = name;
    }

    public abstract void initialize();

    public String getName() {
        return name;
    }
}

// Class extending abstract class
public class AdminService extends BaseService {
    public AdminService() {
        super("AdminService");
    }

    @Override
    public void initialize() {
        System.out.println("Initializing " + getName());
    }

    // Method specific to AdminService
    public void grantPermission(String permission) {
        System.out.println("Granting permission: " + permission);
    }
}

// Constants class
public class Constants {
    public static final int MAX_USERS = 1000;
    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final String DEFAULT_ROLE = "USER";
}

// Point class for testing
public class Point {
    private double x;
    private double y;

    public Point(double x, double y) {
        this.x = x;
        this.y = y;
    }

    public double getX() {
        return x;
    }

    public double getY() {
        return y;
    }

    public double distance() {
        return Math.sqrt(x * x + y * y);
    }
}

// Main class
public class Main {
    public static void main(String[] args) {
        UserService service = new UserService();

        try {
            User user1 = UserService.createUser(1, "John Doe", "john@example.com");
            User user2 = UserService.createUser(2, "Jane Smith", "jane@example.com");

            service.addUser(user1);
            service.addUser(user2);

            List<User> activeUsers = service.listActiveUsers();
            System.out.println("Active users: " + activeUsers.size());
        } catch (IllegalArgumentException e) {
            System.err.println("Error: " + e.getMessage());
        }
    }
}

