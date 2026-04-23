{pkgs}: {
  deps = [
    pkgs.at-spi2-core
    pkgs.xorg.libxshmfence
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libxcb
    pkgs.xorg.libX11
    pkgs.dbus
    pkgs.alsa-lib
    pkgs.cairo
    pkgs.pango
    pkgs.expat
    pkgs.mesa
    pkgs.libxkbcommon
    pkgs.libdrm
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
  ];
}
