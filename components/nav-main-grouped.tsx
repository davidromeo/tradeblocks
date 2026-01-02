"use client";

import { type Icon, IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  href: string;
  icon: Icon;
  badge?: string;
  soon?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

export function NavMainGrouped({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarMenu>
        {groups.map((group) => {
          // Check if any item in this group is active
          const hasActiveItem = group.items.some(
            (item) =>
              pathname === item.href || pathname.startsWith(`${item.href}/`)
          );

          return (
            <Collapsible
              key={group.title}
              asChild
              defaultOpen={hasActiveItem}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={group.title}>
                    <span className="flex-1 font-medium">{group.title}</span>
                    <IconChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {group.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                      return (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton asChild isActive={isActive}>
                            <Link href={item.href}>
                              <item.icon className="size-4" />
                              <span>{item.title}</span>
                              {item.badge && (
                                <Badge
                                  variant="secondary"
                                  className="ml-auto text-[10px] px-1.5 py-0"
                                >
                                  {item.badge}
                                </Badge>
                              )}
                              {item.soon && (
                                <Badge
                                  variant="outline"
                                  className="ml-auto text-[10px] uppercase tracking-wide px-1.5 py-0"
                                >
                                  Soon
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
