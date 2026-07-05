#!/usr/bin/env bash
# =============================================================================
#  VitCam -- User Setup Helper
#  Run this as ROOT on a fresh Ubuntu/Debian server BEFORE running the
#  main VitCam installer.
#
#  Usage:
#    sudo bash setup/create-user.sh <username>
#    -- or if already root --
#    bash setup/create-user.sh <username>
#
#  What it does:
#    1. Creates the user if they don't exist
#    2. Adds the user to the sudo group
#    3. Prints the su command to switch to that user
# =============================================================================

# -- Colours ------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[VitCam]${RESET} $*"; }
success() { echo -e "${GREEN}[OK]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[X]${RESET} $*"; exit 1; }

# -- Must be root -------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root. Try: sudo bash setup/create-user.sh <username>"
fi

# -- Require username argument ------------------------------------------------
if [[ -z "${1:-}" ]]; then
  echo ""
  echo -e "  Usage: ${BOLD}sudo bash setup/create-user.sh <username>${RESET}"
  echo ""
  echo -e "  Example:"
  echo -e "    ${BOLD}sudo bash setup/create-user.sh vitcam${RESET}"
  echo ""
  exit 1
fi

USERNAME="$1"

echo ""
echo -e "${BOLD}${CYAN}== VitCam User Setup ==${RESET}"
echo ""

# -- Create user if not exists ------------------------------------------------
if id "$USERNAME" &>/dev/null; then
  warn "User '$USERNAME' already exists -- skipping creation."
else
  info "Creating user '$USERNAME'..."
  adduser --gecos "" "$USERNAME"
  success "User '$USERNAME' created."
fi

# -- Add to sudo group --------------------------------------------------------
info "Adding '$USERNAME' to sudo group..."
usermod -aG sudo "$USERNAME"
success "User '$USERNAME' now has sudo privileges."

# -- Add to docker group if docker is installed --------------------------------
if getent group docker &>/dev/null; then
  usermod -aG docker "$USERNAME"
  success "User '$USERNAME' added to docker group."
fi

# -- Done ---------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  User '$USERNAME' is ready.${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Now switch to the new user and run the VitCam installer:"
echo ""
echo -e "    ${BOLD}su - $USERNAME${RESET}"
echo -e "    ${BOLD}cd $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)${RESET}"
echo -e "    ${BOLD}chmod +x install-linux.sh${RESET}"
echo -e "    ${BOLD}./install-linux.sh${RESET}"
echo ""
echo -e "  ${YELLOW}Or if using SSH, log out and log back in as '$USERNAME'.${RESET}"
echo ""
