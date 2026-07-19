#!/usr/bin/env bash
# Build an uncompressed initrd (cpio) with GNU bash for the v86 Buildroot guest.
# Uses Alpine Linux x86 (i386) packages — matches the 32-bit v86 CPU.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/v86/bash-overlay.cpio"
ALPINE_VER="${ALPINE_VER:-v3.20}"
BASE="https://dl-cdn.alpinelinux.org/alpine/${ALPINE_VER}/main/x86"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

cd "$WORKDIR"

# Pin versions that exist on Alpine 3.20 x86 (override via env if needed)
BASH_APK="${BASH_APK:-bash-5.2.26-r0.apk}"
READLINE_APK="${READLINE_APK:-readline-8.2.10-r0.apk}"
MUSL_APK="${MUSL_APK:-musl-1.2.5-r3.apk}"
NCURSES_APK="${NCURSES_APK:-libncursesw-6.4_p20240420-r2.apk}"
TERMINFO_APK="${TERMINFO_APK:-ncurses-terminfo-base-6.4_p20240420-r2.apk}"

echo "→ downloading Alpine x86 packages from $BASE"
for apk in "$BASH_APK" "$READLINE_APK" "$MUSL_APK" "$NCURSES_APK" "$TERMINFO_APK"; do
  curl -fsSL -O "$BASE/$apk"
done

mkdir root
for apk in *.apk; do
  gzip -dc "$apk" | tar -xf - -C root \
    --exclude='.SIGN*' --exclude='.PKGINFO' --exclude='.dummy' \
    --exclude='.pre-*' --exclude='.post-*' 2>/dev/null || true
done
find root -maxdepth 1 -name '.*' -delete 2>/dev/null || true

# Ensure libc soname symlink
if [[ -f root/lib/ld-musl-i386.so.1 && ! -e root/lib/libc.musl-x86.so.1 ]]; then
  ln -s ld-musl-i386.so.1 root/lib/libc.musl-x86.so.1
fi

# Drop Alpine profile/bashrc — they assume full Alpine userspace and break on Buildroot
rm -rf root/etc/profile.d root/etc/bash root/etc/inputrc root/root 2>/dev/null || true
mkdir -p root/usr/local/bin

# Helper: clean bash without Alpine profiles
cat > root/usr/local/bin/bash-clean <<'EOF'
#!/bin/sh
export TERM="${TERM:-linux}"
export PS1='\u@v86:\w\$ '
exec /bin/bash --norc --noprofile "$@"
EOF
chmod +x root/bin/bash root/usr/local/bin/bash-clean
# Uncompressed newc cpio (v86 will not gunzip initrd)
mkdir -p "$(dirname "$OUT")"
( cd root && find . | cpio -o -H newc 2>/dev/null ) > "$OUT"

ls -lah "$OUT"
echo "OK — $OUT"
echo "Test: ls + bash --version should work after boot with this initrd."
