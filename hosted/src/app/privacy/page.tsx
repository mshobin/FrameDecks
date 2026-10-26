import type { Metadata } from "next";

import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Privacy" };

// Linked from Google's and Microsoft's sign-in consent screens; keep it true to what the companion and sync store.
export default function PrivacyPage() {
  return (
    <AuthShell eyebrow="Policy" title="Privacy" document>
      <div className="auth-legal">
        <p>Last updated 26 October 2026.</p>
        <h2>What FRAMEDECKS is</h2>
        <p>
          FRAMEDECKS is a free presentation program for churches and study groups. It runs on your own service PC.
          This website, the companion, lets the people in your workspace see and edit the plan and run the service
          from a phone.
        </p>
        <h2>What is stored online</h2>
        <ul>
          <li>Your account: your email address, and your name if you sign in with Google or Microsoft.</li>
          <li>Your display name, your workspaces and your role in each one.</li>
          <li>
            The service plan that a linked PC shares: Frame names, their words (scripture, questions, scripts) and their
            order, with 30 days of earlier versions so changes can be undone.
          </li>
          <li>
            The member list your workspace keeps: names and, where your workspace adds them, country, phone, email,
            birth date, role and groups.
          </li>
          <li>The names of linked PCs, and a log of who changed people, roles, invitations and PCs.</li>
        </ul>
        <h2>What is never stored online</h2>
        <p>
          Pictures, videos, PDFs, audio, the camera and what is on screen stay on the service PC. Nothing is sent
          while you present except the commands you choose to send from the companion.
        </p>
        <h2>Who can see it</h2>
        <p>
          Only the people in your workspace, according to their role. FRAMEDECKS has no advertising and no tracking,
          and does not sell or share your data. It is kept by Supabase (the database and sign-in) and served by
          Cloudflare (this website).
        </p>
        <h2>Google and Microsoft sign-in</h2>
        <p>
          If you choose them, FRAMEDECKS receives only your email address, your name and a sign-in confirmation. It
          never sees your password and reads nothing else from your account.
        </p>
        <h2>Removing your data</h2>
        <p>
          A workspace owner or admin can remove people and members at any time. To delete your account or a whole
          workspace, write to <a href="mailto:mshobin@gmail.com">mshobin@gmail.com</a>; it is done within 30 days.
          Nightly encrypted backups are kept for 30 days and then deleted.
        </p>
      </div>
    </AuthShell>
  );
}
