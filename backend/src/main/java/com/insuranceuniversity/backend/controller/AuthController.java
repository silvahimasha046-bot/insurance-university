package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.auth.JwtService;
import com.insuranceuniversity.backend.entity.UserEntity;
import com.insuranceuniversity.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${admin.email}")
    private String adminEmail;

    @Value("${admin.password}")
    private String adminPassword;

    public AuthController(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    /** POST /api/auth/register — register a new user */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String email = body.get("email");
        String password = body.get("password");

        if (name == null || email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "name, email, and password are required"));
        }
        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.status(409).body(Map.of("error", "Email already registered"));
        }

        UserEntity user = new UserEntity();
        user.setName(name);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole("USER");
        userRepository.save(user);

        String token = jwtService.generateToken(email, "USER");
        return ResponseEntity.ok(Map.of("token", token, "name", name, "email", email));
    }

    /** POST /api/auth/login — login for registered users */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        Optional<UserEntity> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent() && passwordEncoder.matches(password, userOpt.get().getPasswordHash())) {
            UserEntity user = userOpt.get();
            String token = jwtService.generateToken(email, user.getRole());
            return ResponseEntity.ok(Map.of("token", token, "name", user.getName(), "email", email, "role", user.getRole()));
        }
        return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
    }

    /** POST /api/auth/admin/login — dedicated admin login */
    @PostMapping("/admin/login")
    public ResponseEntity<?> adminLogin(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        if (adminEmail.equals(email) && adminPassword.equals(password)) {
            String token = jwtService.generateToken(email, "ADMIN");
            return ResponseEntity.ok(Map.of("accessToken", token));
        }
        return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
    }
}
