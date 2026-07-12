#!/usr/bin/env python3
"""Build optimized macOS icon resources from generated SooKool logo concepts."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from PIL import Image


ICONSET_SIZES = (
    (16, "icon_16x16.png"),
    (32, "icon_16x16@2x.png"),
    (32, "icon_32x32.png"),
    (64, "icon_32x32@2x.png"),
    (128, "icon_128x128.png"),
    (256, "icon_128x128@2x.png"),
    (256, "icon_256x256.png"),
    (512, "icon_256x256@2x.png"),
    (512, "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
)


def remove_preview_background(image: Image.Image) -> Image.Image:
    """Convert the near-black image-generation preview surround to alpha."""
    rgba = image.convert("RGBA")
    pixels = []
    for red, green, blue, _ in rgba.getdata():
        brightness = max(red, green, blue)
        if brightness <= 4:
            alpha = 0
        elif brightness >= 24:
            alpha = 255
        else:
            alpha = round((brightness - 4) / 20 * 255)
        pixels.append((red, green, blue, alpha))
    rgba.putdata(pixels)
    return rgba


def save_png(image: Image.Image, destination: Path, size: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    resized = image.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(destination, "PNG", optimize=True, compress_level=9)


def build_variant(source: Path, resource_stem: str, workspace: Path) -> Path:
    image = remove_preview_background(Image.open(source))
    resources = workspace / "resources"
    iconset = resources / f"{resource_stem}.iconset"
    master = resources / f"{resource_stem}.png"
    icns = resources / f"{resource_stem}.icns"

    save_png(image, master, 1024)
    for size, filename in ICONSET_SIZES:
        save_png(image, iconset / filename, size)

    # Pillow writes a standards-compliant multi-resolution ICNS directly. This
    # also avoids iconutil rejecting valid RGBA iconsets on newer macOS builds.
    image.save(
        icns,
        "ICNS",
        sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)],
    )
    return master


def build_windows_icon(source: Path, destination: Path) -> None:
    image = remove_preview_background(Image.open(source))
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(
        destination,
        "ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--light", type=Path, required=True)
    parser.add_argument("--dark", type=Path, required=True)
    parser.add_argument("--workspace", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()

    workspace = args.workspace.resolve()
    light = build_variant(args.light, "sookool-app-icon", workspace)
    dark = build_variant(args.dark, "sookool-app-icon-dark", workspace)
    windows_icon = workspace / "resources/sookool-app-icon.ico"
    build_windows_icon(args.light, windows_icon)

    renderer_assets = workspace / "src/renderer/src/assets"
    renderer_assets.mkdir(parents=True, exist_ok=True)
    shutil.copy2(
        workspace / "resources/sookool-app-icon.iconset/icon_128x128.png",
        renderer_assets / "sookool-app-icon-ui.png",
    )
    shutil.copy2(
        workspace / "resources/sookool-app-icon-dark.iconset/icon_128x128.png",
        renderer_assets / "sookool-app-icon-ui-dark.png",
    )
    shutil.copy2(light, workspace / "resources/sookool-app-icon-preview.png")

    build_resources = workspace / "build"
    build_resources.mkdir(parents=True, exist_ok=True)
    shutil.copy2(workspace / "resources/sookool-app-icon.icns", build_resources / "icon.icns")
    shutil.copy2(light, build_resources / "icon.png")
    shutil.copy2(workspace / "resources/sookool-app-icon-dark.icns", build_resources / "icon-dark.icns")
    shutil.copy2(dark, build_resources / "icon-dark.png")
    shutil.copy2(windows_icon, build_resources / "icon.ico")


if __name__ == "__main__":
    main()
