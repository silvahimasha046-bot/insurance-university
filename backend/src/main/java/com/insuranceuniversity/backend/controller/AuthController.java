package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.auth.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtService jwtService;

    @Value("${admin.email}")
    private String adminEmail;

    @Value("${admin.password}")
    private String adminPassword;

    public AuthController(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @PostMapping("/admin/login")
    public ResponseEntity<?> adminLogin(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        if (adminEmail.equals(email) && adminPassword.equals(password)) {
            String token = jwtService.generateToken(email);
            return ResponseEntity.ok(Map.of("accessToken", token));
        }
        return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
    }
}
