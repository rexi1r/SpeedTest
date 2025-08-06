include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-nclink
PKG_VERSION:=1.6
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-nclink
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=Applications
  DEPENDS:=+luci-base +lua +luci-lib-jsonc +luci-lib-httpclient +wireguard-tools +kmod-wireguard +xl2tpd +ppp +kmod-pppol2tp +kmod-pppox
  TITLE:=LuCI nclink Application
endef

define Package/luci-app-nclink/description
  This package provides a simple "nclink" application for LuCI.
endef

define Build/Prepare
  mkdir -p $(PKG_BUILD_DIR)/luasrc/controller \
          $(PKG_BUILD_DIR)/luasrc/view/nclink \
          $(PKG_BUILD_DIR)/htdocs/luci-static/resources/nclink
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/luci-app-nclink/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view/nclink
	$(INSTALL_DIR) $(1)/www/luci-static/resources/nclink
	
	$(INSTALL_DATA) ./luasrc/controller/nclink.lua $(1)/usr/lib/lua/luci/controller/
	$(INSTALL_DATA) ./luasrc/view/nclink.htm $(1)/usr/lib/lua/luci/view/nclink/
	$(INSTALL_DATA) ./luasrc/view/status.htm $(1)/usr/lib/lua/luci/view/nclink/
	$(INSTALL_DATA) ./luasrc/view/wizard.htm $(1)/usr/lib/lua/luci/view/nclink/
	$(INSTALL_DATA) ./htdocs/luci-static/nclink/* $(1)/www/luci-static/resources/nclink/
endef

$(eval $(call BuildPackage,luci-app-nclink))