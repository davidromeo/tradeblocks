"""Utility helpers for building themed placeholder Plotly figures."""

from __future__ import annotations

from typing import Any, Dict, Optional

import plotly.graph_objects as go

from app.utils.theme import get_theme_colors

# Neutral color used when theme information is unavailable.
_FALLBACK_TEXT_COLOR = "#8a93a6"

# Colors tuned for accessibility in light vs dark themes.
_LIGHT_MODE_TEXT_COLOR = "#2f3d51"
_DARK_MODE_TEXT_COLOR = "#dce2f2"


def _resolve_text_color(
    theme_data: Optional[Dict[str, Any]],
    theme_colors: Optional[Dict[str, Any]] = None,
) -> str:
    """Return a readable text color given theme data (or lack thereof)."""

    # If we have concrete theme colors, trust those first so placeholders match real charts.
    if theme_colors and isinstance(theme_colors, dict):
        text_color = theme_colors.get("text_color")
        if isinstance(text_color, str) and text_color:
            return text_color

    resolved: Optional[str] = None
    preference: Optional[str] = None

    if theme_data and isinstance(theme_data, dict):
        resolved = theme_data.get("resolved")
        preference = theme_data.get("theme")

    # Normalize strings (handle unexpected casing).
    if isinstance(resolved, str):
        resolved = resolved.lower()
    if isinstance(preference, str):
        preference = preference.lower()

    if resolved in {"dark", "light"}:
        return _DARK_MODE_TEXT_COLOR if resolved == "dark" else _LIGHT_MODE_TEXT_COLOR

    if preference in {"dark", "light"}:
        return _DARK_MODE_TEXT_COLOR if preference == "dark" else _LIGHT_MODE_TEXT_COLOR

    # No reliable signal – use a neutral shade that works in both themes.
    return _FALLBACK_TEXT_COLOR


def create_placeholder_figure(
    text: str,
    *,
    theme_data: Optional[Dict[str, Any]] = None,
    font_size: int = 16,
    annotation_kwargs: Optional[Dict[str, Any]] = None,
    layout_kwargs: Optional[Dict[str, Any]] = None,
) -> go.Figure:
    """Build a centered annotation-only placeholder figure.

    Parameters
    ----------
    text:
        HTML-capable text content for the placeholder annotation.
    theme_data:
        Optional theme store payload so we can align colors with the active theme.
        When missing we fall back to a neutral color that reads on light and dark.
    font_size:
        Base font size used for the annotation copy.
    annotation_kwargs:
        Extra keyword arguments forwarded to `Figure.add_annotation`.
    layout_kwargs:
        Extra keyword arguments forwarded to `Figure.update_layout`.
    """
    theme_colors = get_theme_colors(theme_data)
    text_color = _resolve_text_color(theme_data, theme_colors)

    annotation_options: Dict[str, Any] = {
        "text": text,
        "xref": "paper",
        "yref": "paper",
        "x": 0.5,
        "y": 0.5,
        "showarrow": False,
        "font": {"size": font_size, "color": text_color},
        "xanchor": "center",
        "yanchor": "middle",
    }
    if annotation_kwargs:
        annotation_options.update(annotation_kwargs)

    fig = go.Figure()
    fig.add_annotation(**annotation_options)

    base_layout: Dict[str, Any] = {
        "paper_bgcolor": "rgba(0,0,0,0)",
        "plot_bgcolor": "rgba(0,0,0,0)",
        "font": {"color": text_color},
        "xaxis": {"visible": False},
        "yaxis": {"visible": False},
        "showlegend": False,
        "autosize": True,
        "margin": {"l": 20, "r": 20, "t": 20, "b": 20},
    }

    # Preserve grid transparency while still respecting theme when provided.
    if theme_colors.get("grid_color"):
        base_layout["xaxis"].update({"showgrid": False, "gridcolor": theme_colors["grid_color"]})
        base_layout["yaxis"].update({"showgrid": False, "gridcolor": theme_colors["grid_color"]})

    if layout_kwargs:
        base_layout.update(layout_kwargs)

    fig.update_layout(**base_layout)
    return fig


__all__ = ["create_placeholder_figure"]
