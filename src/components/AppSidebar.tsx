import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Bell, User as UserIcon, LogOut, Leaf, LogIn,
  Mic, Droplets, Scale, CalendarDays, Cpu,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const mainItems = [
    { title: t("nav.dashboard"),      url: "/",              icon: LayoutDashboard },
    { title: t("nav.simple"),         url: "/simple",        icon: Mic },
    { title: t("nav.fields"),         url: "/fields",        icon: Droplets },
    { title: t("nav.notifications"),  url: "/notifications", icon: Bell },
    { title: t("nav.profile"),        url: "/profile",       icon: UserIcon },
  ];

  const estimatorItems = [
    { title: t("nav.waterAllocation"),    url: "/estimator",         icon: Scale },
    { title: t("nav.irrigationSchedule"), url: "/estimator/results", icon: CalendarDays },
    { title: t("nav.yieldPrediction"),    url: "/estimator/charts",  icon: Cpu },
  ];

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/";
    if (url === "/estimator") return pathname === "/estimator";
    return pathname === url || pathname.startsWith(url + "/");
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success(t("toast.signedOut"));
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-leaf text-white shadow-glow">
            <Leaf className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-display text-sm font-semibold leading-tight">{t("app.name")}</h1>
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("app.tagline")}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.main")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link
                      to={item.url}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                        isActive(item.url)
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted/10"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-1.5">
            {t("nav.estimator")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {estimatorItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link
                      to={item.url}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                        isActive(item.url)
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted/10"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {user ? (
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>{t("nav.signout")}</span>}
          </Button>
        ) : (
          <Button asChild variant="default" size="sm" className="w-full justify-start gap-2">
            <Link to="/auth">
              <LogIn className="h-4 w-4" />
              {!collapsed && <span>{t("nav.signin")}</span>}
            </Link>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
