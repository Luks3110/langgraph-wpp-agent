"use client";
import {
  IconArrowLeft,
  IconBolt,
  IconGitBranch,
  IconGraph,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../../supabase/client";
import { Sidebar, SidebarBody, SidebarLink } from "../ui/sidebar";

export function DashboardSidebar() {
  const supabase = createClient();
  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: (
        <IconGraph className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Easy Agent",
      href: "/agents/create",
      icon: (
        <IconBolt className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Agent Flows",
      href: "/agents/create-flow",
      icon: (
        <IconGitBranch className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
  ];

  const [open, setOpen] = useState(false);

  return (
    <Sidebar open={open} setOpen={setOpen} animate={true}>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <Logo />
          <div className="mt-8 flex flex-col gap-2">
            {links.map((link, idx) => (
              <SidebarLink key={idx} link={link} />
            ))}
          </div>
        </div>
        <SidebarLink
          link={{
            label: "Logout",
            href: "#",
            icon: (
              <IconArrowLeft className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
            ),
          }}
          props={{
            onClick: () => {
              supabase.auth.signOut();
            },
            prefetch: true,
          }}
        />
      </SidebarBody>
    </Sidebar>
  );
}

export const Logo = () => {
  return (
    <Link
      href="#"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-black dark:bg-white" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium whitespace-pre text-black dark:text-white"
      >
        Acet Labs
      </motion.span>
    </Link>
  );
};
