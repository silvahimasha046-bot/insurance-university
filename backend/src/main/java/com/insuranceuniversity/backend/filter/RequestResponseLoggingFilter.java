package com.insuranceuniversity.backend.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Servlet filter that logs every inbound HTTP request and its outbound response
 * (including error responses) via Log4j2.
 *
 * <ul>
 *   <li><b>REQUEST</b>  – method, URI, query string, relevant headers, body (sensitive fields redacted)</li>
 *   <li><b>RESPONSE</b> – HTTP status, body (sensitive fields redacted), duration</li>
 *   <li><b>ERROR</b>    – uncaught exception class name (message omitted to avoid PII leakage)</li>
 * </ul>
 */
@Component
@Order(1)
public class RequestResponseLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LogManager.getLogger(RequestResponseLoggingFilter.class);

    /** Maximum number of bytes of a request/response body that will be logged. */
    private static final int MAX_BODY_LOG_BYTES = 4096;

    /** HTTP request/response headers that must never be logged. */
    private static final Set<String> REDACTED_HEADERS = Set.of(
            "authorization", "cookie", "set-cookie", "x-api-key"
    );

    /**
     * Pattern that matches JSON fields whose values are considered sensitive.
     * Replaces the value with {@code "***"}.
     */
    private static final Pattern SENSITIVE_FIELD_PATTERN = Pattern.compile(
            "(?i)(\"(?:password|passwd|secret|token|accessToken|refreshToken|apiKey|api_key|jwt|credential|ssn|cardNumber|cvv)\"\\s*:\\s*)\"[^\"]*\"",
            Pattern.CASE_INSENSITIVE
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        ContentCachingRequestWrapper wrappedRequest = new ContentCachingRequestWrapper(request);
        ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);

        long startTime = System.currentTimeMillis();

        try {
            filterChain.doFilter(wrappedRequest, wrappedResponse);
        } catch (Exception ex) {
            // Log only the exception class – omit the message to avoid accidental PII exposure
            log.error("[ERROR] {} {} | exception={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    ex.getClass().getName());
            throw ex;
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            logRequest(wrappedRequest);
            logResponse(wrappedRequest, wrappedResponse, duration);
            // Copy body back so the client actually receives it
            wrappedResponse.copyBodyToResponse();
        }
    }

    // -------------------------------------------------------------------------

    private void logRequest(ContentCachingRequestWrapper request) {
        String headers = Collections.list(request.getHeaderNames())
                .stream()
                .filter(h -> !REDACTED_HEADERS.contains(h.toLowerCase()))
                .map(h -> h + "=" + request.getHeader(h))
                .collect(Collectors.joining(", "));

        String body = sanitize(readBody(request.getContentAsByteArray(), request.getCharacterEncoding()));

        if (body.isEmpty()) {
            log.info("[REQUEST]  {} {} {} | headers=[{}]",
                    request.getMethod(),
                    request.getRequestURI(),
                    queryString(request),
                    headers);
        } else {
            log.info("[REQUEST]  {} {} {} | headers=[{}] | body={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    queryString(request),
                    headers,
                    body);
        }
    }

    private void logResponse(ContentCachingRequestWrapper request,
                             ContentCachingResponseWrapper response,
                             long durationMs) {
        String body = sanitize(readBody(response.getContentAsByteArray(), response.getCharacterEncoding()));
        int status = response.getStatus();

        if (status >= 400) {
            log.warn("[RESPONSE] {} {} | status={} | duration={}ms | body={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    status,
                    durationMs,
                    body);
        } else {
            log.info("[RESPONSE] {} {} | status={} | duration={}ms | body={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    status,
                    durationMs,
                    body);
        }
    }

    // -------------------------------------------------------------------------

    /**
     * Redacts values of known sensitive JSON fields so they never appear in log files.
     */
    private String sanitize(String body) {
        if (body == null || body.isEmpty()) {
            return body;
        }
        return SENSITIVE_FIELD_PATTERN.matcher(body).replaceAll("$1\"***\"");
    }

    private String readBody(byte[] content, String encoding) {
        if (content == null || content.length == 0) {
            return "";
        }
        int length = Math.min(content.length, MAX_BODY_LOG_BYTES);
        String charset = (encoding != null) ? encoding : StandardCharsets.UTF_8.name();
        try {
            String body = new String(content, 0, length, charset);
            if (content.length > MAX_BODY_LOG_BYTES) {
                body += " ... [truncated, total=" + content.length + " bytes]";
            }
            return body;
        } catch (Exception e) {
            return "[unreadable body]";
        }
    }

    private String queryString(HttpServletRequest request) {
        String qs = request.getQueryString();
        return (qs != null && !qs.isEmpty()) ? "?" + qs : "";
    }
}
