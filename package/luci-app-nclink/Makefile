include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-speedtest
PKG_VERSION:=1.6
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-speedtest
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=Applications
  DEPENDS:=+luci-base +lua +luci-lib-jsonc +luci-lib-httpclient +wireguard-tools +kmod-wireguard +xl2tpd +ppp +kmod-pppol2tp +kmod-pppox
  TITLE:=LuCI speedtest Application
endef

define Package/luci-app-speedtest/description
  This package provides a simple "speedtest" application for LuCI.
endef

define Build/Prepare
  mkdir -p $(PKG_BUILD_DIR)/luasrc/controller \
          $(PKG_BUILD_DIR)/luasrc/view/speedtest \
          $(PKG_BUILD_DIR)/luasrc/view/pingtest \
          $(PKG_BUILD_DIR)/htdocs/luci-static/resources/speedtest
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/luci-app-speedtest/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view/speedtest
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view/pingtest
	$(INSTALL_DIR) $(1)/www/luci-static/resources/speedtest

	$(INSTALL_DATA) ./luasrc/controller/speedtest.lua $(1)/usr/lib/lua/luci/controller/
	$(INSTALL_DATA) ./luasrc/controller/pingtest.lua $(1)/usr/lib/lua/luci/controller/
	$(INSTALL_DATA) ./luasrc/view/speedtest.htm $(1)/usr/lib/lua/luci/view/speedtest/
	$(INSTALL_DATA) ./luasrc/view/status.htm $(1)/usr/lib/lua/luci/view/speedtest/
	$(INSTALL_DATA) ./luasrc/view/wizard.htm $(1)/usr/lib/lua/luci/view/speedtest/
	$(INSTALL_DATA) ./luasrc/view/pingtest/index.htm $(1)/usr/lib/lua/luci/view/pingtest/
	$(INSTALL_DATA) ./htdocs/luci-static/speedtest/* $(1)/www/luci-static/resources/speedtest/
endef

$(eval $(call BuildPackage,luci-app-speedtest))