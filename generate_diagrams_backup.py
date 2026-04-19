#!/usr/bin/env python3
"""
Diagram generator for Insurance University Final Project Report.
Generates all technical diagrams as PNG files using matplotlib.
"""

import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Arc, Wedge, Circle
import matplotlib.lines as mlines
import numpy as np

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "report_diagrams")
os.makedirs(OUT_DIR, exist_ok=True)

# ─── Colour palette ─────────────────────────────────────────────────────────
C_PRIMARY = "#1565C0"
C_SECONDARY = "#0D47A1"
C_ACCENT = "#FF8F00"
C_LIGHT = "#E3F2FD"
C_WHITE = "#FFFFFF"
C_GREY = "#F5F5F5"
C_DARK = "#212121"
C_GREEN = "#2E7D32"
C_RED = "#C62828"
C_PURPLE = "#6A1B9A"
C_TEAL = "#00695C"
C_ORANGE = "#E65100"
C_PINK = "#AD1457"


def _save(fig, name):
    path = os.path.join(OUT_DIR, name)
    fig.savefig(path, dpi=200, bbox_inches="tight", facecolor="white", edgecolor="none")
    plt.close(fig)
    print(f"  ✓ {name}")
    return path


def _box(ax, x, y, w, h, text, color=C_PRIMARY, text_color="white", fontsize=9, lw=1.5, radius=0.02):
    box = FancyBboxPatch(
        (x - w / 2, y - h / 2), w, h,
        boxstyle=f"round,pad=0.02,rounding_size={radius}",
        facecolor=color, edgecolor="#333333", linewidth=lw, zorder=3,
    )
    ax.add_patch(box)
    ax.text(x, y, text, ha="center", va="center", fontsize=fontsize,
            fontweight="bold", color=text_color, zorder=4, wrap=True,
            fontfamily="sans-serif")
    return box


def _arrow(ax, x1, y1, x2, y2, color="#333", style="-|>", lw=1.5):
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color, lw=lw),
                zorder=2)


def _label_arrow(ax, x1, y1, x2, y2, label, color="#333"):
    _arrow(ax, x1, y1, x2, y2, color=color)
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    ax.text(mx, my + 0.03, label, ha="center", va="bottom", fontsize=7,
            color=color, fontstyle="italic", fontfamily="sans-serif")


# ═════════════════════════════════════════════════════════════════════════════
# DIAGRAM 1: System Architecture
# ═════════════════════════════════════════════════════════════════════════════
def gen_architecture():
    fig, ax = plt.subplots(figsize=(12, 7))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis("off")
    ax.set_title("Figure 1: System Architecture Diagram", fontsize=14, fontweight="bold", pad=15, fontfamily="sans-serif")

    # Frontend
    _box(ax, 3, 6, 4.5, 0.9, "Angular 21 SPA\n(Port 4200)", C_PRIMARY)
    ax.text(3, 6.55, "Frontend", ha="center", fontsize=8, color=C_DARK, fontfamily="sans-serif")
    # Sub-components
    for i, (lbl, clr) in enumerate([
        ("Wizard\n(3 Steps)", "#42A5F5"),
        ("Recommendations\n& Compare", "#42A5F5"),
        ("Admin\nConsole", "#42A5F5"),
        ("Auth &\nGuards", "#42A5F5"),
    ]):
        _box(ax, 1.3 + i * 1.55, 5.0, 1.4, 0.65, lbl, clr, fontsize=7)

    # Backend
    _box(ax, 3, 3.5, 4.5, 0.9, "Spring Boot 3.3.5 REST API\n(Port 8080)", C_GREEN)
    ax.text(3, 4.05, "Backend", ha="center", fontsize=8, color=C_DARK, fontfamily="sans-serif")
    # Sub-components
    for i, (lbl, clr) in enumerate([
        ("Controllers\n& Auth", "#66BB6A"),
        ("Services &\nBusiness Logic", "#66BB6A"),
        ("JPA\nRepositories", "#66BB6A"),
        ("AI Engine\nClient", "#66BB6A"),
    ]):
        _box(ax, 1.3 + i * 1.55, 2.5, 1.4, 0.6, lbl, clr, fontsize=7)

    # AI Engine
    _box(ax, 9.0, 3.5, 3.2, 0.9, "FastAPI AI Engine\n(Port 8000)", C_PURPLE)
    ax.text(9.0, 4.05, "AI Engine", ha="center", fontsize=8, color=C_DARK, fontfamily="sans-serif")
    for i, (lbl, clr) in enumerate([
        ("CART\nUnderwriting", "#AB47BC"),
        ("Scoring &\nFiltering", "#AB47BC"),
    ]):
        _box(ax, 8.2 + i * 1.6, 2.5, 1.45, 0.6, lbl, clr, fontsize=7)

    # Database
    _box(ax, 3, 1.0, 3.5, 0.8, "MySQL 8.4 Database\n(Port 3306)", C_ORANGE)
    ax.text(3, 1.5, "Database", ha="center", fontsize=8, color=C_DARK, fontfamily="sans-serif")

    # Docker
    docker_rect = mpatches.FancyBboxPatch(
        (0.2, 0.4), 11.5, 6.3, boxstyle="round,pad=0.1", fill=False,
        edgecolor="#999", linewidth=1, linestyle="--", zorder=1,
    )
    ax.add_patch(docker_rect)
    ax.text(11.5, 0.55, "Docker Compose", ha="right", fontsize=8, color="#999", fontstyle="italic", fontfamily="sans-serif")

    # Arrows
    _label_arrow(ax, 3, 5.55, 3, 3.95, "REST / JWT Bearer", C_DARK)
    _label_arrow(ax, 5.25, 3.5, 7.4, 3.5, "REST (score/train)", C_DARK)
    _label_arrow(ax, 3, 2.1, 3, 1.4, "JDBC / JPA", C_DARK)

    # User icons
    ax.text(3, 6.85, "👤 Customer / 👤 Admin", ha="center", fontsize=9, fontfamily="sans-serif")

    return _save(fig, "01_architecture.png")


# ═════════════════════════════════════════════════════════════════════════════
# DIAGRAM 2: Fishbone (Ishikawa) Diagram
# ═════════════════════════════════════════════════════════════════════════════
def gen_fishbone():
    fig, ax = plt.subplots(figsize=(14, 7.5))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 7.5)
    ax.axis("off")
    ax.set_title("Figure 2: Fishbone (Ishikawa) Diagram – Insurance Advisory Problems",
                 fontsize=13, fontweight="bold", pad=15, fontfamily="sans-serif")

    # Main spine
    ax.annotate("", xy=(13, 3.75), xytext=(1, 3.75),
                arrowprops=dict(arrowstyle="-|>", color=C_DARK, lw=3))

    # Problem box (head)
    _box(ax, 12.2, 3.75, 3.0, 1.0, "Low Insurance\nPenetration in\nSri Lanka", C_RED, fontsize=10)

    # Bone categories with causes
    categories = [
        ("People", 2.5, 6.2, [
            "Agent commission bias",
            "Limited agent training",
            "Low digital literacy",
        ]),
        ("Process", 5.0, 6.2, [
            "Manual needs assessment",
            "Paper proposal forms",
            "Multi-visit requirement",
        ]),
        ("Technology", 7.5, 6.2, [
            "No digital platform",
            "No AI/ML scoring",
            "No online KYC",
        ]),
        ("Information", 2.5, 1.3, [
            "Opaque pricing logic",
            "No analytics/audit trail",
            "No product comparison",
        ]),
        ("Environment", 5.0, 1.3, [
            "Regulatory complexity",
            "Urban-centric agents",
            "Low trust in insurers",
        ]),
        ("Products", 7.5, 1.3, [
            "Complex product features",
            "No personalisation",
            "Limited customisation",
        ]),
    ]

    for cat_name, cx, cy, causes in categories:
        # Branch line from spine to category
        spine_x = cx + 0.5
        if cy > 3.75:
            ax.plot([spine_x, cx], [3.75, cy - 0.4], color=C_PRIMARY, lw=2, zorder=2)
        else:
            ax.plot([spine_x, cx], [3.75, cy + 0.4], color=C_PRIMARY, lw=2, zorder=2)

        # Category label
        _box(ax, cx, cy, 2.2, 0.5, cat_name, C_PRIMARY, fontsize=10)

        # Cause lines
        for i, cause in enumerate(causes):
            if cy > 3.75:
                cause_y = cy - 0.7 - i * 0.45
                ax.plot([cx - 0.3, cx + 0.3], [cause_y, cause_y + 0.2], color="#666", lw=1)
                ax.text(cx - 0.4, cause_y - 0.02, cause, ha="right", va="center",
                        fontsize=7.5, color=C_DARK, fontfamily="sans-serif")
            else:
                cause_y = cy + 0.7 + i * 0.45
                ax.plot([cx - 0.3, cx + 0.3], [cause_y, cause_y - 0.2], color="#666", lw=1)
                ax.text(cx - 0.4, cause_y + 0.02, cause, ha="right", va="center",
                        fontsize=7.5, color=C_DARK, fontfamily="sans-serif")

    return _save(fig, "02_fishbone.png")


# ═════════════════════════════════════════════════════════════════════════════
# DIAGRAM 3: Onion Model (Stakeholders)
# ═════════════════════════════════════════════════════════════════════════════
def gen_onion():
    fig, ax = plt.subplots(figsize=(10, 10))
    ax.set_xlim(-5.5, 5.5)
    ax.set_ylim(-5.5, 5.5)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("Figure 3: Onion Model – Stakeholder View",
                 fontsize=14, fontweight="bold", pad=15, fontfamily="sans-serif")

    layers = [
        (4.8, "#E8EAF6", "Layer 4: Wider Environment"),
        (3.5, "#C5CAE9", "Layer 3: Indirect Users & Operators"),
        (2.2, "#7986CB", "Layer 2: Direct Users"),
        (1.0, "#3F51B5", "Layer 1: The Product"),
    ]

    for r, color, label in layers:
        circle = plt.Circle((0, 0), r, facecolor=color, edgecolor="#333", linewidth=1.5, zorder=1)
        ax.add_patch(circle)

    # Layer labels
    ax.text(0, 0, "Insurance\nUniversity\nPlatform", ha="center", va="center",
            fontsize=11, fontweight="bold", color="white", zorder=5, fontfamily="sans-serif")

    ax.text(0, 1.6, "Layer 2: Direct Users", ha="center", fontsize=9, fontweight="bold",
            color="white", zorder=5, fontfamily="sans-serif")
    ax.text(0, 1.3, "• Customers (Insurance Seekers)", ha="center", fontsize=8, color="white", zorder=5, fontfamily="sans-serif")
    ax.text(0, -1.6, "• Administrators (Product Managers)", ha="center", fontsize=8, color="white", zorder=5, fontfamily="sans-serif")

    ax.text(0, 2.8, "Layer 3: Indirect Users", ha="center", fontsize=9, fontweight="bold",
            color=C_DARK, zorder=5, fontfamily="sans-serif")
    ax.text(0, 2.5, "• IT Operations Team", ha="center", fontsize=8, color=C_DARK, zorder=5, fontfamily="sans-serif")
    ax.text(0, -2.7, "• Data Science / AI Team", ha="center", fontsize=8, color=C_DARK, zorder=5, fontfamily="sans-serif")

    ax.text(0, 4.2, "Layer 4: Wider Environment", ha="center", fontsize=9, fontweight="bold",
            color=C_DARK, zorder=5, fontfamily="sans-serif")
    ax.text(-2.5, 3.6, "IRCSL\n(Regulator)", ha="center", fontsize=8, color=C_DARK, zorder=5, fontfamily="sans-serif")
    ax.text(2.5, 3.6, "Government\nof Sri Lanka", ha="center", fontsize=8, color=C_DARK, zorder=5, fontfamily="sans-serif")
    ax.text(-2.5, -3.8, "Banking &\nFinancial Inst.", ha="center", fontsize=8, color=C_DARK, zorder=5, fontfamily="sans-serif")
    ax.text(2.5, -3.8, "Infrastructure\nProviders", ha="center", fontsize=8, color=C_DARK, zorder=5, fontfamily="sans-serif")

    return _save(fig, "03_onion_model.png")


# ═════════════════════════════════════════════════════════════════════════════
# DIAGRAM 4: High-Level Architecture
# ═════════════════════════════════════════════════════════════════════════════
def gen_high_level_arch():
    fig, ax = plt.subplots(figsize=(13, 6))
    ax.set_xlim(0, 13)
    ax.set_ylim(0, 6)
    ax.axis("off")
    ax.set_title("Figure 4: High-Level Architecture Diagram",
                 fontsize=13, fontweight="bold", pad=15, fontfamily="sans-serif")

    # User
    ax.text(1.0, 3.0, "👤", fontsize=40, ha="center", va="center")
    ax.text(1.0, 1.8, "Customer /\nAdmin", ha="center", fontsize=9, fontfamily="sans-serif")

    # Browser
    _box(ax, 3.3, 3.0, 2.0, 1.8, "Browser\n\nAngular 21\nSPA\n:4200", "#1976D2", fontsize=9)

    # Backend
    _box(ax, 6.8, 3.0, 2.0, 1.8, "Spring Boot\nREST API\n\nJava 17\n:8080", C_GREEN, fontsize=9)

    # AI
    _box(ax, 10.3, 4.3, 2.0, 1.3, "FastAPI\nAI Engine\n:8000", C_PURPLE, fontsize=9)

    # DB
    _box(ax, 10.3, 1.7, 2.0, 1.3, "MySQL 8.4\nDatabase\n:3306", C_ORANGE, fontsize=9)

    # Arrows
    _arrow(ax, 1.7, 3.0, 2.3, 3.0)
    _label_arrow(ax, 4.3, 3.0, 5.8, 3.0, "HTTP/REST\nJWT Bearer")
    _label_arrow(ax, 7.8, 3.8, 9.3, 4.3, "POST /score\nPOST /train")
    _label_arrow(ax, 7.8, 2.4, 9.3, 1.7, "JDBC\nJPA/Hibernate")

    # File storage
    _box(ax, 10.3, 0.3, 2.0, 0.5, "Filesystem (uploads/)", "#78909C", fontsize=8)
    ax.plot([10.3, 10.3], [1.05, 0.55], color="#666", lw=1.5, zorder=2)

    return _save(fig, "04_high_level_arch.png")


# ═════════════════════════════════════════════════════════════════════════════
# DIAGRAM 5: Use Case Diagram
# ═════════════════════════════════════════════════════════════════════════════
def gen_use_case():
    fig, ax = plt.subplots(figsize=(14, 12))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 12)
    ax.axis("off")
    ax.set_title("Figure 5: Use Case Diagram – Insurance University",
                 fontsize=14, fontweight="bold", pad=15, fontfamily="sans-serif")

    # System boundary
    rect = mpatches.FancyBboxPatch(
        (3.5, 0.5), 7, 11, boxstyle="round,pad=0.2", fill=True,
        facecolor="#F5F5F5", edgecolor=C_DARK, linewidth=2, zorder=0,
    )
    ax.add_patch(rect)
    ax.text(7, 11.3, "Insurance University System", ha="center", fontsize=12,
            fontweight="bold", color=C_DARK, fontfamily="sans-serif")

    # Customer actor (left)
    ax.text(1.5, 8.0, "👤", fontsize=36, ha="center", va="center")
    ax.text(1.5, 7.2, "Customer", ha="center", fontsize=10, fontweight="bold", fontfamily="sans-serif")

    # Admin actor (right)
    ax.text(12.5, 4.5, "👤", fontsize=36, ha="center", va="center")
    ax.text(12.5, 3.7, "Administrator", ha="center", fontsize=10, fontweight="bold", fontfamily="sans-serif")

    # AI Engine actor (right bottom)
    ax.text(12.5, 1.5, "⚙️", fontsize=30, ha="center", va="center")
    ax.text(12.5, 0.9, "AI Engine", ha="center", fontsize=10, fontweight="bold", fontfamily="sans-serif")

    # Customer use cases
    customer_ucs = [
        (5.5, 10.5, "UC-01: Register"),
        (5.5, 9.8, "UC-02: Login"),
        (5.5, 9.1, "UC-03: Complete Wizard"),
        (5.5, 8.4, "UC-04: Get Recommendations"),
        (5.5, 7.7, "UC-05: Compare Products"),
        (5.5, 7.0, "UC-06: Use Simulator"),
        (5.5, 6.3, "UC-07: Upload KYC Docs"),
        (5.5, 5.6, "UC-08: Submit Proposal"),
        (5.5, 4.9, "UC-09: View Past Sessions"),
        (5.5, 4.2, "UC-10: Submit Feedback"),
        (5.5, 3.5, "UC-11: Chat Data Capture"),
    ]

    for x, y, label in customer_ucs:
        ellipse = mpatches.Ellipse((x, y), 3.0, 0.55, facecolor=C_LIGHT, edgecolor=C_PRIMARY, linewidth=1.5, zorder=2)
        ax.add_patch(ellipse)
        ax.text(x, y, label, ha="center", va="center", fontsize=8, color=C_DARK, zorder=3, fontfamily="sans-serif")
        ax.plot([2.0, 4.0], [8.0, y], color="#999", lw=0.8, zorder=1)

    # Admin use cases
    admin_ucs = [
        (8.5, 8.4, "UC-12: Admin Login"),
        (8.5, 7.7, "UC-13: Manage Products"),
        (8.5, 7.0, "UC-14: Manage Categories"),
        (8.5, 6.3, "UC-15: Manage Rules"),
        (8.5, 5.6, "UC-16: Upload Training Data"),
        (8.5, 4.9, "UC-17: Manage AI Models"),
        (8.5, 4.2, "UC-18: View/Export Logs"),
        (8.5, 3.5, "UC-19: Manage Unmatched Needs"),
        (8.5, 2.8, "UC-20: Manage Pricing Tables"),
    ]

    for x, y, label in admin_ucs:
        ellipse = mpatches.Ellipse((x, y), 3.0, 0.55, facecolor="#FFF3E0", edgecolor=C_ORANGE, linewidth=1.5, zorder=2)
        ax.add_patch(ellipse)
        ax.text(x, y, label, ha="center", va="center", fontsize=8, color=C_DARK, zorder=3, fontfamily="sans-serif")
        ax.plot([12.0, 10.0], [4.5, y], color="#999", lw=0.8, zorder=1)

    # AI Engine connections
    ax.plot([12.0, 7.0], [1.5, 8.4], color=C_PURPLE, lw=1, linestyle="--", zorder=1)
    ax.text(10.5, 3.8, "<<uses>>", fontsize=7, color=C_PURPLE, rotation=55, fontfamily="sans-serif")
    ax.plot([12.0, 10.0], [1.5, 5.6], color=C_PURPLE, lw=1, linestyle="--", zorder=1)

    # Include relationships
    ax.plot([5.5, 5.5], [8.4, 9.1], color=C_PRIMARY, lw=1, linestyle=":", zorder=1)
    ax.text(6.0, 8.75, "<<include>>", fontsize=6, color=C_PRIMARY, fontfamily="sans-serif")

    return _save(fig, "05_use_case.png")


# ═════════════════════════════════════════════════════════════════════════════
# DIAGRAM 6: Class Diagram (Entity Model)
# ═════════════════════════════════════════════════════════════════════════════
def gen_class_diagram():
    fig, ax = plt.subplots(figsize=(18, 14))
    ax.set_xlim(0, 18)
    ax.set_ylim(0, 14)
    ax.axis("off")
    ax.set_title("Figure 6: Class Diagram – Backend Entity Model",
                 fontsize=14, fontweight="bold", pad=15, fontfamily="sans-serif")

    def _class_box(ax, x, y, name, attrs, ops, w=3.2, color=C_PRIMARY):
        total_lines = 1 + len(attrs) + len(ops) + 0.5
        h = total_lines * 0.22 + 0.3
        # Class name box
        name_h = 0.4
        rect_name = FancyBboxPatch((x, y), w, name_h, boxstyle="round,pad=0.02",
                                    facecolor=color, edgecolor="#333", lw=1.5, zorder=3)
        ax.add_patch(rect_name)
        ax.text(x + w/2, y + name_h/2, name, ha="center", va="center",
                fontsize=9, fontweight="bold", color="white", zorder=4, fontfamily="sans-serif")
        # Attributes box
        attr_h = len(attrs) * 0.22 + 0.1
        rect_attr = FancyBboxPatch((x, y - attr_h), w, attr_h,
                                    boxstyle="square,pad=0.02",
                                    facecolor=C_WHITE, edgecolor="#333", lw=1, zorder=3)
        ax.add_patch(rect_attr)
        for i, a in enumerate(attrs):
            ax.text(x + 0.1, y - 0.15 - i * 0.22, a, fontsize=6.5, color=C_DARK, zorder=4, fontfamily="monospace")
        # Operations box
        ops_h = len(ops) * 0.22 + 0.1
        rect_ops = FancyBboxPatch((x, y - attr_h - ops_h), w, ops_h,
                                   boxstyle="square,pad=0.02",
                                   facecolor="#F9FBE7", edgecolor="#333", lw=1, zorder=3)
        ax.add_patch(rect_ops)
        for i, o in enumerate(ops):
            ax.text(x + 0.1, y - attr_h - 0.15 - i * 0.22, o, fontsize=6.5, color=C_DARK, zorder=4, fontfamily="monospace")
        return (x + w/2, y - attr_h - ops_h/2)  # center of whole class

    # UserEntity
    _class_box(ax, 0.3, 13.2, "UserEntity", [
        "- id: Long", "- name: String", "- email: String «unique»",
        "- passwordHash: String", "- role: Role (USER|ADMIN)", "- createdAt: LocalDateTime",
    ], ["+ getEmail(): String", "+ getRole(): Role"], w=3.4, color=C_GREEN)

    # CustomerSessionEntity
    _class_box(ax, 4.5, 13.2, "CustomerSessionEntity", [
        "- id: String «UUID»", "- status: String", "- userEmail: String",
        "- createdAt: LocalDateTime", "- updatedAt: LocalDateTime",
    ], ["+ getStatus(): String"], w=3.6, color=C_PRIMARY)

    # CustomerAnswerEntity
    _class_box(ax, 0.3, 10.0, "CustomerAnswerEntity", [
        "- id: Long", "- sessionId: String «FK»", "- key: String",
        "- valueJson: String «JSON»", "- createdAt: LocalDateTime",
    ], ["+ getValueJson(): String"], w=3.4, color="#5C6BC0")

    # CustomerDocumentEntity
    _class_box(ax, 4.5, 10.0, "CustomerDocumentEntity", [
        "- id: Long", "- sessionId: String «FK»", "- userEmail: String",
        "- docType: String", "- docSide: String", "- storedPath: String",
        "- versionNo: int", "- latestForSession: boolean",
    ], ["+ getDocType(): String"], w=3.6, color="#5C6BC0")

    # RecommendationRunEntity
    _class_box(ax, 9.0, 13.2, "RecommendationRunEntity", [
        "- id: Long", "- sessionId: String «FK»",
        "- requestJson: String «LONGTEXT»", "- responseJson: String «LONGTEXT»",
        "- createdAt: LocalDateTime",
    ], ["+ getResponseJson(): String"], w=3.6, color="#5C6BC0")

    # ChatMessageEntity
    _class_box(ax, 9.0, 10.0, "CustomerChatMessageEntity", [
        "- id: Long", "- sessionId: String", "- role: String",
        "- message: String «TEXT»", "- metadataJson: String",
        "- createdAt: LocalDateTime",
    ], ["+ getRole(): String"], w=3.6, color="#5C6BC0")

    # SessionLogEntity
    _class_box(ax, 13.5, 13.2, "SessionLogEntity", [
        "- id: Long", "- sessionHash: String «SHA-256»",
        "- timestamp: LocalDateTime", "- eventType: String",
        "- userSegment: String", "- payloadJson: String",
    ], ["+ getEventType(): String"], w=3.6, color=C_TEAL)

    # ProductEntity
    _class_box(ax, 0.3, 6.5, "ProductEntity", [
        "- id: Long", "- code: String «unique»", "- name: String",
        "- basePremium: BigDecimal", "- tagsJson: String", "- benefitsJson: String",
        "- ridersJson: String", "- eligibilityJson: String",
        "- minEligibleAge: int", "- maxEligibleAge: int",
    ], ["+ getCode(): String"], w=3.4, color=C_ORANGE)

    # InsuranceCategoryEntity
    _class_box(ax, 4.5, 6.5, "InsuranceCategoryEntity", [
        "- id: Long", "- code: String", "- name: String",
        "- description: String", "- active: boolean", "- displayOrder: int",
    ], ["+ isActive(): boolean"], w=3.6, color=C_ACCENT)

    # InsuranceSubcategoryEntity
    _class_box(ax, 4.5, 3.5, "InsuranceSubcategoryEntity", [
        "- id: Long", "- code: String", "- name: String",
        "- description: String", "- active: boolean",
        "- categoryId: Long «FK»",
    ], ["+ isActive(): boolean"], w=3.6, color=C_ACCENT)

    # EligibilityRuleEntity
    _class_box(ax, 0.3, 3.5, "EligibilityRuleEntity", [
        "- id: Long", "- name: String", "- ruleJson: String",
        "- version: int", "- effectiveFrom: LocalDate",
        "- effectiveTo: LocalDate",
    ], ["+ getRuleJson(): String"], w=3.4, color=C_RED)

    # DatasetMetaEntity
    _class_box(ax, 9.0, 6.5, "DatasetMetaEntity", [
        "- id: Long", "- originalFilename: String",
        "- storedPath: String", "- fileSize: long",
        "- formatVersion: String", "- trainingGoal: String",
    ], ["+ getStoredPath(): String"], w=3.6, color=C_PINK)

    # ModelVersionEntity
    _class_box(ax, 9.0, 3.5, "ModelVersionEntity", [
        "- id: Long", "- name: String", "- artifactId: String",
        "- sourceDatasetId: Long «FK»", "- rowsProcessed: int",
        "- active: boolean",
    ], ["+ isActive(): boolean"], w=3.6, color=C_PINK)

    # PricingTableEntity
    _class_box(ax, 13.5, 6.5, "PricingTableEntity", [
        "- id: Long", "- name: String", "- pricingJson: String",
        "- version: int", "- effectiveFrom: LocalDate",
    ], ["+ getPricingJson(): String"], w=3.6, color="#78909C")

    # UnmatchedNeedEntity
    _class_box(ax, 13.5, 3.5, "UnmatchedNeedEntity", [
        "- id: Long", "- theme: String",
        "- occurrences: int", "- sampleAnonymisedText: String",
        "- updatedAt: LocalDateTime",
    ], ["+ getTheme(): String"], w=3.6, color="#78909C")

    # Relationships (simplified lines)
    # Session -> Answers (1:N)
    ax.annotate("", xy=(2.0, 10.8), xytext=(5.5, 12.2),
                arrowprops=dict(arrowstyle="-", color="#333", lw=1.2))
    ax.text(3.2, 11.6, "1..*", fontsize=7, color="#333", fontfamily="sans-serif")

    # Session -> Documents (1:N)
    ax.annotate("", xy=(5.5, 10.8), xytext=(5.5, 12.2),
                arrowprops=dict(arrowstyle="-", color="#333", lw=1.2))

    # Session -> Recommendations (1:N)
    ax.annotate("", xy=(10.0, 12.2), xytext=(7.0, 12.2),
                arrowprops=dict(arrowstyle="-", color="#333", lw=1.2))
    ax.text(8.5, 12.3, "1..*", fontsize=7, color="#333", fontfamily="sans-serif")

    # Session -> Chat (1:N)
    ax.annotate("", xy=(10.0, 10.8), xytext=(7.0, 12.0),
                arrowprops=dict(arrowstyle="-", color="#333", lw=1.2))

    # Category -> Subcategory (1:N)
    ax.annotate("", xy=(6.3, 4.5), xytext=(6.3, 5.5),
                arrowprops=dict(arrowstyle="-|>", color="#333", lw=1.2))
    ax.text(6.5, 5.0, "1..*", fontsize=7, color="#333", fontfamily="sans-serif")

    # Product -> Category (N:1)
    ax.annotate("", xy=(4.5, 6.0), xytext=(3.7, 6.0),
                arrowprops=dict(arrowstyle="-|>", color="#333", lw=1.2))

    # Dataset -> Model (1:N)
    ax.annotate("", xy=(10.8, 4.5), xytext=(10.8, 5.5),
                arrowprops=dict(arrowstyle="-|>", color="#333", lw=1.2))
    ax.text(11.0, 5.0, "1..*", fontsize=7, color="#333", fontfamily="sans-serif")

    return _save(fig, "06_class_diagram.png")


# ═════════════════════════════════════════════════════════════════════════════
# DIAGRAM 7: Sequence Diagram
# ═════════════════════════════════════════════════════════════════════════════
def gen_sequence():
    fig, ax = plt.subplots(figsize=(18, 14))
    ax.set_xlim(0, 18)
    ax.set_ylim(0, 14)
    ax.axis("off")
    ax.set_title("Figure 7: Sequence Diagram – Get Insurance Recommendations (UC-04)",
                 fontsize=13, fontweight="bold", pad=15, fontfamily="sans-serif")

    # Lifelines
    lifelines = [
        (1.5, "Customer", "#FFB74D"),
        (3.5, "Angular\nSPA", C_PRIMARY),
        (5.5, "Auth\nInterceptor", "#78909C"),
        (7.5, "Customer\nController", C_GREEN),
        (9.5, "Session\nService", "#66BB6A"),
        (11.5, "Answer\nRepo", "#A5D6A7"),
        (13.0, "Product\nRepo", "#A5D6A7"),
        (14.5, "AI Engine\nClient", C_PURPLE),
        (16.5, "FastAPI\nAI Engine", "#AB47BC"),
    ]

    top_y = 13.0
    bottom_y = 1.0

    for x, label, color in lifelines:
        _box(ax, x, top_y, 1.3, 0.6, label, color, fontsize=7)
        ax.plot([x, x], [top_y - 0.3, bottom_y], color="#999", lw=1, linestyle="--", zorder=1)

    # Messages
    def msg(y, x1_idx, x2_idx, label, ret=False):
        x1 = lifelines[x1_idx][0]
        x2 = lifelines[x2_idx][0]
        style = "<|-" if ret else "-|>"
        color = "#999" if ret else "#333"
        ax.annotate("", xy=(x2, y), xytext=(x1, y),
                    arrowprops=dict(arrowstyle=style, color=color, lw=1.2,
                                    linestyle="--" if ret else "-"))
        mid_x = (x1 + x2) / 2
        ax.text(mid_x, y + 0.12, label, ha="center", va="bottom", fontsize=6.5,
                color=C_DARK, fontfamily="sans-serif")

    y = 12.2
    msg(y, 0, 1, "1. Click 'Get Recommendations'"); y -= 0.6
    msg(y, 1, 2, "2. POST /sessions/{id}/recommendations"); y -= 0.6
    msg(y, 2, 3, "3. Attach JWT Bearer token"); y -= 0.6
    msg(y, 3, 4, "4. getRecommendations(sessionId)"); y -= 0.6
    msg(y, 4, 5, "5. findBySessionId(id)"); y -= 0.5
    msg(y, 5, 4, "6. List<Answer>", ret=True); y -= 0.6
    msg(y, 4, 4, "7. buildFeatures(answers)"); y -= 0.6
    msg(y, 4, 6, "8. findAll() [products]"); y -= 0.5
    msg(y, 6, 4, "9. List<Product>", ret=True); y -= 0.6
    msg(y, 4, 4, "10. applyEligibilityRules()"); y -= 0.6
    msg(y, 4, 7, "11. score(sessionId, features, products)"); y -= 0.6
    msg(y, 7, 8, "12. POST /score {JSON}"); y -= 0.6

    # AI engine processing box
    proc_y = y
    proc_box = FancyBboxPatch((15.8, y - 1.4), 1.4, 1.6, boxstyle="round,pad=0.05",
                               facecolor="#F3E5F5", edgecolor=C_PURPLE, lw=1.5, zorder=3)
    ax.add_patch(proc_box)
    proc_steps = [
        "a. CART underwriting",
        "b. Score calculation",
        "c. Coverage prediction",
        "d. Premium estimation",
        "e. Affordability check",
        "f. Rank & follow-ups",
    ]
    for i, step in enumerate(proc_steps):
        ax.text(16.5, y - 0.1 - i * 0.22, step, ha="center", fontsize=5.5,
                color=C_DARK, zorder=4, fontfamily="sans-serif")
    y -= 1.8

    msg(y, 8, 7, "13. {rankedProducts, followUpQs}", ret=True); y -= 0.5
    msg(y, 7, 4, "14. response map", ret=True); y -= 0.6
    msg(y, 4, 4, "15. persist RecommendationRun"); y -= 0.5
    msg(y, 4, 4, "16. write SessionLog"); y -= 0.5
    msg(y, 4, 3, "17. response map", ret=True); y -= 0.5
    msg(y, 3, 1, "18. HTTP 200 {JSON}", ret=True); y -= 0.5
    msg(y, 1, 0, "19. Render product cards", ret=True)

    return _save(fig, "07_sequence.png")


# ═════════════════════════════════════════════════════════════════════════════
# DIAGRAM 8: ER Diagram
# ═════════════════════════════════════════════════════════════════════════════
def gen_er_diagram():
    fig, ax = plt.subplots(figsize=(19, 12))
    ax.set_xlim(-0.2, 19)
    ax.set_ylim(-0.5, 11)
    ax.axis("off")
    ax.set_title("Figure 8: Entity-Relationship Diagram",
                 fontsize=14, fontweight="bold", pad=15, fontfamily="sans-serif")

    def er_box(x, y, name, pk, fields, color=C_PRIMARY, w=2.8):
        h_name = 0.35
        h_pk = 0.25
        h_fields = len(fields) * 0.22 + 0.1
        total_h = h_name + h_pk + h_fields
        # Name
        r1 = FancyBboxPatch((x, y), w, h_name, boxstyle="square,pad=0.02",
                             facecolor=color, edgecolor="#333", lw=1.5, zorder=3)
        ax.add_patch(r1)
        ax.text(x + w/2, y + h_name/2, name, ha="center", va="center",
                fontsize=8, fontweight="bold", color="white", zorder=4, fontfamily="sans-serif")
        # PK
        r2 = FancyBboxPatch((x, y - h_pk), w, h_pk, boxstyle="square,pad=0.02",
                             facecolor="#FFF9C4", edgecolor="#333", lw=0.8, zorder=3)
        ax.add_patch(r2)
        ax.text(x + 0.08, y - h_pk/2, f"PK  {pk}", ha="left", va="center",
                fontsize=6.5, fontweight="bold", color=C_DARK, zorder=4, fontfamily="monospace")
        # Fields
        r3 = FancyBboxPatch((x, y - h_pk - h_fields), w, h_fields, boxstyle="square,pad=0.02",
                             facecolor=C_WHITE, edgecolor="#333", lw=0.8, zorder=3)
        ax.add_patch(r3)
        for i, f in enumerate(fields):
            prefix = "FK  " if "FK" in f else "    "
            clean = f.replace(" FK", "")
            ax.text(x + 0.08, y - h_pk - 0.12 - i * 0.22, prefix + clean,
                    fontsize=6, color=C_DARK, zorder=4, fontfamily="monospace")
        cx = x + w / 2
        cy = y - total_h / 2
        return cx, y, cx, y - h_pk - h_fields

    def rel_line(ax, x1, y1, x2, y2, card1="1", card2="*"):
        ax.plot([x1, x2], [y1, y2], color="#555", lw=1.5, zorder=2)
        mx, my = (x1+x2)/2, (y1+y2)/2
        ax.text(x1 + (x2-x1)*0.15, y1 + (y2-y1)*0.15, card1, fontsize=7,
                fontweight="bold", color=C_RED, zorder=5, fontfamily="sans-serif")
        ax.text(x2 - (x2-x1)*0.15, y2 - (y2-y1)*0.15, card2, fontsize=7,
                fontweight="bold", color=C_RED, zorder=5, fontfamily="sans-serif")

    # Entities — Row 1 (top): y=10.2
    _, ut, _, ub = er_box(0.3, 10.2, "users", "id BIGINT", [
        "name VARCHAR", "email VARCHAR «UQ»", "passwordHash VARCHAR",
        "role ENUM", "createdAt DATETIME",
    ], C_GREEN)

    _, st, _, sb = er_box(3.8, 10.2, "customer_sessions", "id VARCHAR «UUID»", [
        "status VARCHAR", "userEmail VARCHAR FK", "createdAt DATETIME",
        "updatedAt DATETIME",
    ], C_PRIMARY)

    # Row 2 (middle-upper): y=7.2
    _, at, _, ab = er_box(0.3, 7.2, "customer_answers", "id BIGINT", [
        "sessionId VARCHAR FK", "key VARCHAR", "valueJson TEXT",
        "createdAt DATETIME",
    ], "#5C6BC0")

    _, dt, _, db_ = er_box(3.8, 7.2, "customer_documents", "id BIGINT", [
        "sessionId VARCHAR FK", "userEmail VARCHAR", "docType VARCHAR",
        "docSide VARCHAR", "storedPath VARCHAR", "versionNo INT",
    ], "#5C6BC0")

    _, rt, _, rb_ = er_box(7.5, 10.2, "recommendation_runs", "id BIGINT", [
        "sessionId VARCHAR FK", "requestJson LONGTEXT",
        "responseJson LONGTEXT", "createdAt DATETIME",
    ], "#5C6BC0")

    _, cht, _, chb = er_box(7.5, 7.2, "customer_chat_messages", "id BIGINT", [
        "sessionId VARCHAR FK", "role VARCHAR", "message TEXT",
        "metadataJson TEXT", "createdAt DATETIME",
    ], "#5C6BC0")

    _, slt, _, slb = er_box(11.5, 10.2, "session_logs", "id BIGINT", [
        "sessionHash VARCHAR", "timestamp DATETIME",
        "eventType VARCHAR", "userSegment VARCHAR", "payloadJson TEXT",
    ], C_TEAL)

    # Row 3 (middle-lower): y=4.0
    _, pt, _, pb = er_box(0.3, 4.0, "products", "id BIGINT", [
        "code VARCHAR «UQ»", "name VARCHAR", "basePremium DECIMAL",
        "tagsJson TEXT", "category_id BIGINT FK", "subcategory_id BIGINT FK",
    ], C_ORANGE)

    _, ct, _, cb = er_box(3.8, 4.0, "insurance_categories", "id BIGINT", [
        "code VARCHAR", "name VARCHAR", "active BOOLEAN",
        "displayOrder INT",
    ], C_ACCENT)

    # Row 4 (bottom): y=1.7
    _, sct, _, scb = er_box(3.8, 1.7, "insurance_subcategories", "id BIGINT", [
        "code VARCHAR", "name VARCHAR", "active BOOLEAN",
        "category_id BIGINT FK",
    ], C_ACCENT)

    _, ert, _, erb = er_box(7.5, 4.0, "eligibility_rules", "id BIGINT", [
        "name VARCHAR", "ruleJson TEXT", "version INT",
        "effectiveFrom DATE", "effectiveTo DATE",
    ], C_RED)

    _, dmt, _, dmb = er_box(11.5, 7.2, "dataset_meta", "id BIGINT", [
        "originalFilename VARCHAR", "storedPath VARCHAR",
        "fileSize BIGINT", "formatVersion VARCHAR",
    ], C_PINK)

    _, mvt, _, mvb = er_box(11.5, 4.0, "model_versions", "id BIGINT", [
        "name VARCHAR", "artifactId VARCHAR",
        "sourceDatasetId BIGINT FK", "rowsProcessed INT", "active BOOLEAN",
    ], C_PINK)

    _, prt, _, prb = er_box(14.5, 7.2, "pricing_tables", "id BIGINT", [
        "name VARCHAR", "pricingJson TEXT", "version INT",
        "effectiveFrom DATE",
    ], "#78909C")

    _, unt, _, unb = er_box(14.5, 4.0, "unmatched_needs", "id BIGINT", [
        "theme VARCHAR", "occurrences INT",
        "sampleAnonymisedText TEXT", "updatedAt DATETIME",
    ], "#78909C")

    # Relationships
    # sessions -> answers (1:N)
    rel_line(ax, 4.0, sb - 0.05, 2.0, at + 0.05, "1", "*")
    # sessions -> documents (1:N)
    rel_line(ax, 5.5, sb - 0.05, 5.5, dt + 0.05, "1", "*")
    # sessions -> recommendations (1:N)
    rel_line(ax, 6.6, st - 0.15, 7.5, rt + 0.05, "1", "*")
    # sessions -> chat (1:N)
    rel_line(ax, 6.6, sb - 0.05, 7.5, cht + 0.05, "1", "*")
    # categories -> subcategories (1:N)
    rel_line(ax, 5.5, cb - 0.05, 5.5, sct + 0.05, "1", "*")
    # categories -> products (1:N)
    rel_line(ax, 3.8, cb - 0.15, 3.0, pt + 0.05, "1", "*")
    # dataset -> models (1:N)
    rel_line(ax, 12.8, dmb - 0.05, 12.8, mvt + 0.05, "1", "*")

    return _save(fig, "08_er_diagram.png")


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════
def generate_all():
    print("Generating diagrams...")
    paths = {}
    paths["architecture"] = gen_architecture()
    paths["fishbone"] = gen_fishbone()
    paths["onion"] = gen_onion()
    paths["high_level"] = gen_high_level_arch()
    paths["use_case"] = gen_use_case()
    paths["class_diagram"] = gen_class_diagram()
    paths["sequence"] = gen_sequence()
    paths["er_diagram"] = gen_er_diagram()
    print(f"\nAll {len(paths)} diagrams generated in: {OUT_DIR}")
    return paths


if __name__ == "__main__":
    generate_all()
