"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  Gift,
  Loader2,
  Lock,
  Mail,
  Plus,
  Target,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { CHALLENGES } from "@/lib/challenges";
import { getCurrentWeekKey } from "@/lib/leaderboard";

type ChallengeProgress = {
  challengeId: string;
  challengeName?: string;
  description?: string;
  bonusPoints: number;
  completed: boolean;
  weekKey: string;
};

type SocialChallenge = {
  id: string;
  name: string;
  type: "friends" | "corporate";
  createdBy: string;
  creatorName: string;
  company: string;
  startDate: string;
  endDate: string;
  status: "active" | "completed";
};

type ChallengeInvitation = {
  id: string;
  challengeId: string;
  challengeName: string;
  challengeType: "friends" | "corporate";
  inviterUid: string;
  inviterName: string;
  inviteeEmail: string;
  status: "pending" | "accepted" | "rejected";
};

type ChallengeMember = {
  uid: string;
  email: string;
  displayName: string;
};

type RankedMember = ChallengeMember & {
  points: number;
};

function getDisplayName(user: User) {
  return user.displayName?.trim() || user.email?.split("@")[0] || "Hybrid Human";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getTodayDateInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function getDatePlusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function ChallengesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<ChallengeProgress[]>([]);
  const [myChallenges, setMyChallenges] = useState<SocialChallenge[]>([]);
  const [invitations, setInvitations] = useState<ChallengeInvitation[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState("");
  const [leaderboard, setLeaderboard] = useState<RankedMember[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionInvitationId, setActionInvitationId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    type: "friends" as "friends" | "corporate",
    company: "",
    startDate: getTodayDateInput(),
    endDate: getDatePlusDays(7),
    inviteEmails: "",
  });

  async function loadAutomaticChallenges(uid: string) {
    const snapshot = await getDocs(
      collection(db, "users", uid, "challengeProgress")
    );
    const weekKey = getCurrentWeekKey();

    const progress: ChallengeProgress[] = snapshot.docs
      .map((progressDocument) => {
        const data = progressDocument.data();
        return {
          challengeId: String(data.challengeId ?? ""),
          challengeName: String(data.challengeName ?? ""),
          description: String(data.description ?? ""),
          bonusPoints: Number(data.bonusPoints ?? 0),
          completed: Boolean(data.completed ?? false),
          weekKey: String(data.weekKey ?? ""),
        };
      })
      .filter((item) => item.weekKey === weekKey && item.completed);

    setCompletedChallenges(progress);
  }

  async function loadSocialData(user: User) {
    const email = normalizeEmail(user.email ?? "");

    const invitationSnapshot = email
      ? await getDocs(
          query(
            collection(db, "challengeInvitations"),
            where("inviteeEmail", "==", email)
          )
        )
      : null;

    const loadedInvitations: ChallengeInvitation[] = invitationSnapshot
      ? invitationSnapshot.docs.map((invitationDocument) => {
          const data = invitationDocument.data();
          return {
            id: invitationDocument.id,
            challengeId: String(data.challengeId ?? ""),
            challengeName: String(data.challengeName ?? ""),
            challengeType: data.challengeType === "corporate" ? "corporate" : "friends",
            inviterUid: String(data.inviterUid ?? ""),
            inviterName: String(data.inviterName ?? "Hybrid Human"),
            inviteeEmail: String(data.inviteeEmail ?? ""),
            status:
              data.status === "accepted"
                ? "accepted"
                : data.status === "rejected"
                ? "rejected"
                : "pending",
          };
        })
      : [];

    setInvitations(loadedInvitations.filter((item) => item.status === "pending"));

    const challengeIds = new Set<string>();

    loadedInvitations
      .filter((item) => item.status === "accepted")
      .forEach((item) => challengeIds.add(item.challengeId));

    const createdSnapshot = await getDocs(
      query(
        collection(db, "socialChallenges"),
        where("createdBy", "==", user.uid)
      )
    );

    createdSnapshot.docs.forEach((challengeDocument) =>
      challengeIds.add(challengeDocument.id)
    );

    const loadedChallenges: SocialChallenge[] = [];

    for (const challengeId of Array.from(challengeIds)) {
      const challengeSnapshot = await getDoc(
        doc(db, "socialChallenges", challengeId)
      );

      if (challengeSnapshot.exists()) {
        const data = challengeSnapshot.data();
        loadedChallenges.push({
          id: challengeSnapshot.id,
          name: String(data.name ?? "Challenge"),
          type: data.type === "corporate" ? "corporate" : "friends",
          createdBy: String(data.createdBy ?? ""),
          creatorName: String(data.creatorName ?? "Hybrid Human"),
          company: String(data.company ?? ""),
          startDate: String(data.startDate ?? ""),
          endDate: String(data.endDate ?? ""),
          status: data.status === "completed" ? "completed" : "active",
        });
      }
    }

    loadedChallenges.sort((a, b) => b.startDate.localeCompare(a.startDate));
    setMyChallenges(loadedChallenges);
  }

  async function loadAll(user: User) {
    setError("");
    await Promise.all([
      loadAutomaticChallenges(user.uid),
      loadSocialData(user),
    ]);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUser(user);

      try {
        await loadAll(user);
      } catch (loadError) {
        console.error("Challenge loading error:", loadError);
        setError("We could not load your challenges.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function createChallenge() {
    if (!currentUser) return;

    setError("");
    setSuccess("");

    const name = form.name.trim();

    if (!name) {
      setError("Enter a challenge name.");
      return;
    }

    if (!form.startDate || !form.endDate) {
      setError("Choose a start and end date.");
      return;
    }

    if (form.endDate < form.startDate) {
      setError("The end date must be after the start date.");
      return;
    }

    if (form.type === "corporate" && !form.company.trim()) {
      setError("Enter the company name for a corporate challenge.");
      return;
    }

    const inviteEmails = Array.from(
      new Set(
        form.inviteEmails
          .split(/[\n,;]+/)
          .map(normalizeEmail)
          .filter(Boolean)
      )
    ).filter(
      (email) => email !== normalizeEmail(currentUser.email ?? "")
    );

    setCreating(true);

    try {
      const creatorName = getDisplayName(currentUser);

      const challengeReference = await addDoc(
        collection(db, "socialChallenges"),
        {
          name,
          type: form.type,
          company: form.type === "corporate" ? form.company.trim() : "",
          startDate: form.startDate,
          endDate: form.endDate,
          status: "active",
          createdBy: currentUser.uid,
          creatorName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      await setDoc(
        doc(
          db,
          "socialChallenges",
          challengeReference.id,
          "members",
          currentUser.uid
        ),
        {
          uid: currentUser.uid,
          email: normalizeEmail(currentUser.email ?? ""),
          displayName: creatorName,
          joinedAt: serverTimestamp(),
        }
      );

      for (const inviteeEmail of inviteEmails) {
        await addDoc(collection(db, "challengeInvitations"), {
          challengeId: challengeReference.id,
          challengeName: name,
          challengeType: form.type,
          inviterUid: currentUser.uid,
          inviterName: creatorName,
          inviteeEmail,
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setSuccess(
        inviteEmails.length
          ? `Challenge created and ${inviteEmails.length} invitation${inviteEmails.length === 1 ? "" : "s"} sent.`
          : "Challenge created."
      );

      setForm({
        name: "",
        type: "friends",
        company: "",
        startDate: getTodayDateInput(),
        endDate: getDatePlusDays(7),
        inviteEmails: "",
      });

      setCreateOpen(false);
      await loadSocialData(currentUser);
    } catch (createError) {
      console.error("Create challenge error:", createError);
      setError("We could not create the challenge.");
    } finally {
      setCreating(false);
    }
  }

  async function respondToInvitation(
    invitation: ChallengeInvitation,
    response: "accepted" | "rejected"
  ) {
    if (!currentUser) return;

    setError("");
    setSuccess("");
    setActionInvitationId(invitation.id);

    try {
      await updateDoc(doc(db, "challengeInvitations", invitation.id), {
        status: response,
        inviteeUid: currentUser.uid,
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (response === "accepted") {
        await setDoc(
          doc(
            db,
            "socialChallenges",
            invitation.challengeId,
            "members",
            currentUser.uid
          ),
          {
            uid: currentUser.uid,
            email: normalizeEmail(currentUser.email ?? ""),
            displayName: getDisplayName(currentUser),
            joinedAt: serverTimestamp(),
          }
        );

        setSuccess(`You joined ${invitation.challengeName}.`);
      } else {
        setSuccess(`You rejected ${invitation.challengeName}.`);
      }

      await loadSocialData(currentUser);
    } catch (responseError) {
      console.error("Invitation response error:", responseError);
      setError("We could not update the invitation.");
    } finally {
      setActionInvitationId("");
    }
  }

  async function openLeaderboard(challengeId: string) {
    if (selectedChallengeId === challengeId) {
      setSelectedChallengeId("");
      setLeaderboard([]);
      return;
    }

    if (!currentUser) {
      setError("You must be logged in to view this leaderboard.");
      return;
    }

    setSelectedChallengeId(challengeId);
    setLeaderboardLoading(true);
    setError("");

    try {
      const idToken = await currentUser.getIdToken(true);

      const response = await fetch(
        `/api/challenges/${challengeId}/leaderboard`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ?? "Unable to load challenge leaderboard."
        );
      }

      const rankedMembers: RankedMember[] = Array.isArray(data.leaderboard)
        ? data.leaderboard.map(
            (member: {
              uid?: string;
              email?: string;
              displayName?: string;
              points?: number;
            }) => ({
              uid: String(member.uid ?? ""),
              email: String(member.email ?? ""),
              displayName: String(member.displayName ?? "Hybrid Human"),
              points: Number(member.points ?? 0),
            })
          )
        : [];

      setLeaderboard(rankedMembers);
    } catch (leaderboardError) {
      console.error("Challenge leaderboard error:", leaderboardError);
      setError(
        leaderboardError instanceof Error
          ? leaderboardError.message
          : "We could not load this challenge leaderboard."
      );
    } finally {
      setLeaderboardLoading(false);
    }
  }

  const totalBonusPoints = completedChallenges.reduce(
    (total, challenge) => total + challenge.bonusPoints,
    0
  );

  const selectedChallenge = useMemo(
    () =>
      myChallenges.find(
        (challenge) => challenge.id === selectedChallengeId
      ) ?? null,
    [myChallenges, selectedChallengeId]
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">
        <Loader2 className="mr-3 animate-spin" size={22} />
        Loading challenges...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06100c] px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-8 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <header>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Competition
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Challenges
            </h1>

            <p className="mt-3 max-w-2xl text-slate-500">
              Complete weekly bonus challenges, create competitions with friends or colleagues, and rank participants by Hybrid Points.
            </p>
          </header>

          <button
            type="button"
            onClick={() => setCreateOpen((value) => !value)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:bg-emerald-400"
          >
            <Plus size={18} />
            Create Challenge
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {createOpen && (
          <section className="mt-8 rounded-3xl border border-emerald-500/20 bg-white/[0.025] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-400">
                  New Competition
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  Create a challenge
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-slate-400 transition hover:text-white"
                aria-label="Close challenge form"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Challenge name
                </span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="September Fitness Battle"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Challenge type
                </span>
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value as "friends" | "corporate",
                    }))
                  }
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0b1712] px-4 text-base text-white outline-none focus:border-emerald-500/50"
                >
                  <option value="friends">Friends</option>
                  <option value="corporate">Corporate</option>
                </select>
              </label>

              {form.type === "corporate" && (
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-slate-300">
                    Company
                  </span>
                  <input
                    value={form.company}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        company: event.target.value,
                      }))
                    }
                    placeholder="Company name"
                    className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Start date
                </span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0b1712] px-4 text-base text-white outline-none focus:border-emerald-500/50"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  End date
                </span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      endDate: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0b1712] px-4 text-base text-white outline-none focus:border-emerald-500/50"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-slate-300">
                  Invite by email
                </span>
                <textarea
                  value={form.inviteEmails}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      inviteEmails: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder={"friend@email.com\ncolleague@company.com"}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Use one email per line, or separate emails with commas.
                </p>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-11 rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={createChallenge}
                disabled={creating}
                className="flex min-h-11 items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <UserPlus size={17} />
                )}
                {creating ? "Creating..." : "Create & Invite"}
              </button>
            </div>
          </section>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Weekly Challenges" value={`${CHALLENGES.length}`} icon={<Target size={20} />} />
          <SummaryCard label="Completed" value={`${completedChallenges.length}`} icon={<Trophy size={20} />} />
          <SummaryCard label="Bonus Points" value={`${totalBonusPoints}`} icon={<Gift size={20} />} />
          <SummaryCard label="Invitations" value={`${invitations.length}`} icon={<Mail size={20} />} />
        </div>

        {invitations.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-3">
              <Mail className="text-emerald-400" size={21} />
              <div>
                <h2 className="text-2xl font-bold">Invitations</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Accept or reject challenge invitations sent to your account email.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {invitations.map((invitation) => {
                const busy = actionInvitationId === invitation.id;

                return (
                  <div
                    key={invitation.id}
                    className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                          {invitation.challengeType === "corporate" ? (
                            <Building2 size={16} />
                          ) : (
                            <Users size={16} />
                          )}
                          {invitation.challengeType === "corporate"
                            ? "Corporate Challenge"
                            : "Friends Challenge"}
                        </div>

                        <h3 className="mt-3 text-xl font-semibold">
                          {invitation.challengeName}
                        </h3>

                        <p className="mt-2 text-sm text-slate-500">
                          Invited by{" "}
                          <span className="text-slate-300">
                            {invitation.inviterName}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respondToInvitation(invitation, "accepted")}
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="animate-spin" size={17} />
                        ) : (
                          <Check size={17} />
                        )}
                        Accept
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respondToInvitation(invitation, "rejected")}
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5 disabled:opacity-60"
                      >
                        <X size={17} />
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="flex items-center gap-3">
            <Users className="text-emerald-400" size={21} />
            <div>
              <h2 className="text-2xl font-bold">My Competitions</h2>
              <p className="mt-1 text-sm text-slate-500">
                Friends and corporate challenges you created or accepted.
              </p>
            </div>
          </div>

          {myChallenges.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-white/10 p-8 text-center">
              <Users className="mx-auto text-slate-600" size={34} />
              <p className="mt-4 font-semibold">No social challenges yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Create a Friends or Corporate challenge and invite people using their Hybrid Human account email.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {myChallenges.map((challenge) => {
                const expanded = selectedChallengeId === challenge.id;

                return (
                  <div
                    key={challenge.id}
                    className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]"
                  >
                    <div className="p-6">
                      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                              {challenge.type === "corporate" ? (
                                <Building2 size={16} />
                              ) : (
                                <Users size={16} />
                              )}
                              {challenge.type === "corporate" ? "Corporate" : "Friends"}
                            </div>

                            {challenge.company && (
                              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">
                                {challenge.company}
                              </span>
                            )}
                          </div>

                          <h3 className="mt-3 truncate text-xl font-semibold">
                            {challenge.name}
                          </h3>

                          <p className="mt-2 text-sm text-slate-500">
                            {challenge.startDate} → {challenge.endDate}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => openLeaderboard(challenge.id)}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
                        >
                          <Trophy size={17} />
                          Leaderboard
                          {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-white/10 bg-black/10 p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold">
                              Challenge Leaderboard
                            </h4>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Only Hybrid Points earned between this challenge&apos;s start and end dates count toward this ranking.
                            </p>
                          </div>

                          {selectedChallenge && (
                            <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                              {selectedChallenge.type === "corporate" ? "Corporate" : "Friends"}
                            </div>
                          )}
                        </div>

                        {leaderboardLoading ? (
                          <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
                            <Loader2 className="animate-spin" size={18} />
                            Loading rankings...
                          </div>
                        ) : leaderboard.length === 0 ? (
                          <p className="py-8 text-sm text-slate-500">
                            No participants found yet.
                          </p>
                        ) : (
                          <div className="mt-5 space-y-2">
                            {leaderboard.map((member, index) => (
                              <div
                                key={member.uid}
                                className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.025] p-4"
                              >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 font-bold text-slate-300">
                                  #{index + 1}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-semibold">
                                    {member.displayName}
                                    {member.uid === currentUser?.uid && (
                                      <span className="ml-2 text-xs font-medium text-emerald-400">
                                        You
                                      </span>
                                    )}
                                  </p>
                                  <p className="truncate text-xs text-slate-500">
                                    {member.email}
                                  </p>
                                </div>

                                <div className="text-right">
                                  <p className="text-lg font-bold">{member.points}</p>
                                  <p className="text-xs text-slate-500">points</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-12">
          <div>
            <h2 className="text-2xl font-bold">Weekly Bonus Challenges</h2>
            <p className="mt-2 text-sm text-slate-500">
              These are automatically completed from your Google Fit workouts and earn bonus Hybrid Points.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {CHALLENGES.map((challenge) => {
              const completed = completedChallenges.some(
                (progress) => progress.challengeId === challenge.id
              );

              return (
                <div
                  key={challenge.id}
                  className={`rounded-3xl border p-6 transition ${
                    completed
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-white/10 bg-white/[0.025]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        completed
                          ? "bg-emerald-500 text-black"
                          : "bg-white/5 text-slate-400"
                      }`}
                    >
                      {completed ? <CheckCircle2 size={24} /> : <Flame size={24} />}
                    </div>

                    <div className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-400">
                      +{challenge.bonusPoints} pts
                    </div>
                  </div>

                  <h3 className="mt-6 text-xl font-semibold">{challenge.name}</h3>

                  <p className="mt-3 min-h-16 text-sm leading-6 text-slate-500">
                    {challenge.description}
                  </p>

                  <div className="mt-6 border-t border-white/10 pt-4">
                    {completed ? (
                      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                        <CheckCircle2 size={17} />
                        Completed this week
                      </p>
                    ) : (
                      <p className="flex items-center gap-2 text-sm text-slate-500">
                        <Lock size={16} />
                        Not completed yet
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="text-emerald-400">{icon}</div>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
