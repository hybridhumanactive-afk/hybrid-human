"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  Building2,
  Check,
  HeartPulse,
  Loader2,
  UserRound,
} from "lucide-react";

import { auth, db } from "@/lib/firebase";

type ProfileData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  height: string;
  weight: string;
  country: string;
  company: string;
  department: string;
};

export default function ProfileSetupPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [form, setForm] =
    useState<ProfileData>({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      sex: "",
      height: "",
      weight: "",
      country: "South Africa",
      company: "",
      department: "",
    });

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace("/login");
            return;
          }

          try {
            const userReference =
              doc(
                db,
                "users",
                user.uid
              );

            const userSnapshot =
              await getDoc(
                userReference
              );

            if (userSnapshot.exists()) {
              const existing =
                userSnapshot.data();

              setForm({
                firstName:
                  existing.firstName ||
                  "",
                lastName:
                  existing.lastName ||
                  "",
                dateOfBirth:
                  existing.dateOfBirth ||
                  "",
                sex:
                  existing.sex ||
                  "",
                height:
                  existing.height
                    ? String(
                        existing.height
                      )
                    : "",
                weight:
                  existing.weight
                    ? String(
                        existing.weight
                      )
                    : "",
                country:
                  existing.country ||
                  "South Africa",
                company:
                  existing.company ||
                  "",
                department:
                  existing.department ||
                  "",
              });
            } else {
              const displayName =
                user.displayName?.trim() ||
                "";

              const nameParts =
                displayName
                  .split(" ")
                  .filter(Boolean);

              setForm(
                (current) => ({
                  ...current,

                  firstName:
                    nameParts[0] ||
                    "",

                  lastName:
                    nameParts.length >
                    1
                      ? nameParts
                          .slice(1)
                          .join(" ")
                      : "",
                })
              );
            }
          } catch (error) {
            console.error(
              "Unable to load profile:",
              error
            );
          } finally {
            setCheckingAuth(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [router]);

  function updateField(
    field: keyof ProfileData,
    value: string
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function calculateAge(
    dateOfBirth: string
  ) {
    if (!dateOfBirth) {
      return null;
    }

    const today =
      new Date();

    const birthDate =
      new Date(
        `${dateOfBirth}T00:00:00`
      );

    let age =
      today.getFullYear() -
      birthDate.getFullYear();

    const monthDifference =
      today.getMonth() -
      birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 &&
        today.getDate() <
          birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      setError(
        "Your session has expired. Please sign in again."
      );

      router.replace(
        "/login"
      );

      return;
    }

    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.dateOfBirth ||
      !form.sex ||
      !form.height ||
      !form.weight
    ) {
      setError(
        "Please complete all required fields."
      );

      return;
    }

    const age =
      calculateAge(
        form.dateOfBirth
      );

    if (
      age === null ||
      age < 1
    ) {
      setError(
        "Please enter a valid date of birth."
      );

      return;
    }

    const height =
      Number(form.height);

    const weight =
      Number(form.weight);

    if (
      Number.isNaN(height) ||
      Number.isNaN(weight) ||
      height <= 0 ||
      weight <= 0
    ) {
      setError(
        "Please enter a valid height and weight."
      );

      return;
    }

    setSaving(true);

    try {
      await updateProfile(
        currentUser,
        {
          displayName:
            `${form.firstName.trim()} ${form.lastName.trim()}`,
        }
      );

      const userReference =
        doc(
          db,
          "users",
          currentUser.uid
        );

      const existingUser =
        await getDoc(
          userReference
        );

      await setDoc(
        userReference,
        {
          uid:
            currentUser.uid,

          email:
            currentUser.email,

          firstName:
            form.firstName.trim(),

          lastName:
            form.lastName.trim(),

          dateOfBirth:
            form.dateOfBirth,

          age,

          sex:
            form.sex,

          height,

          weight,

          country:
            form.country.trim(),

          company:
            form.company.trim(),

          department:
            form.department.trim(),

          profileCompleted:
            true,

          updatedAt:
            serverTimestamp(),

          ...(!existingUser.exists()
            ? {
                createdAt:
                  serverTimestamp(),
              }
            : {}),
        },
        {
          merge: true,
        }
      );

      router.replace(
        "/dashboard"
      );
    } catch (error) {
      console.error(
        "Profile save error:",
        error
      );

      setError(
        "We could not save your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07110d] text-white">

        <div className="flex items-center gap-3 text-slate-400">

          <Loader2
            className="animate-spin"
            size={22}
          />

          Loading your account...

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07110d] px-5 py-10 text-white">

      <div className="mx-auto max-w-4xl">

        <header className="mb-10 flex items-center gap-4">

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-black">

            <HeartPulse
              size={27}
            />

          </div>

          <div>

            <h1 className="text-2xl font-bold">
              Hybrid Human
            </h1>

            <p className="text-sm text-slate-500">
              Create your performance profile
            </p>

          </div>

        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-9">

            <div className="mb-8">

              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Step 2 of 2
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Complete your profile
              </h2>

              <p className="mt-2 max-w-xl text-slate-400">
                These details help Hybrid Human calculate
                training metrics and personalise your
                experience.
              </p>

            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-7"
            >

              <div>

                <div className="mb-4 flex items-center gap-2">

                  <UserRound
                    size={18}
                    className="text-emerald-400"
                  />

                  <h3 className="font-semibold">
                    Personal information
                  </h3>

                </div>

                <div className="grid gap-5 sm:grid-cols-2">

                  <div>

                    <label
                      htmlFor="firstName"
                      className="mb-2 block text-sm text-slate-300"
                    >
                      First name *
                    </label>

                    <input
                      id="firstName"
                      required
                      value={
                        form.firstName
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "firstName",
                          event
                            .target
                            .value
                        )
                      }
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition focus:border-emerald-500"
                    />

                  </div>

                  <div>

                    <label
                      htmlFor="lastName"
                      className="mb-2 block text-sm text-slate-300"
                    >
                      Last name *
                    </label>

                    <input
                      id="lastName"
                      required
                      value={
                        form.lastName
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "lastName",
                          event
                            .target
                            .value
                        )
                      }
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition focus:border-emerald-500"
                    />

                  </div>

                  <div>

                    <label
                      htmlFor="dateOfBirth"
                      className="mb-2 block text-sm text-slate-300"
                    >
                      Date of birth *
                    </label>

                    <input
                      id="dateOfBirth"
                      type="date"
                      required
                      value={
                        form.dateOfBirth
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "dateOfBirth",
                          event
                            .target
                            .value
                        )
                      }
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition focus:border-emerald-500"
                    />

                  </div>

                  <div>

                    <label
                      htmlFor="sex"
                      className="mb-2 block text-sm text-slate-300"
                    >
                      Sex *
                    </label>

                    <select
                      id="sex"
                      required
                      value={
                        form.sex
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "sex",
                          event
                            .target
                            .value
                        )
                      }
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#09130f] px-4 text-white outline-none transition focus:border-emerald-500"
                    >

                      <option value="">
                        Select
                      </option>

                      <option value="Male">
                        Male
                      </option>

                      <option value="Female">
                        Female
                      </option>

                      <option value="Prefer not to say">
                        Prefer not to say
                      </option>

                    </select>

                  </div>

                  <div>

                    <label
                      htmlFor="height"
                      className="mb-2 block text-sm text-slate-300"
                    >
                      Height (cm) *
                    </label>

                    <input
                      id="height"
                      type="number"
                      min="50"
                      max="250"
                      required
                      value={
                        form.height
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "height",
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="e.g. 178"
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
                    />

                  </div>

                  <div>

                    <label
                      htmlFor="weight"
                      className="mb-2 block text-sm text-slate-300"
                    >
                      Weight (kg) *
                    </label>

                    <input
                      id="weight"
                      type="number"
                      step="0.1"
                      min="20"
                      max="400"
                      required
                      value={
                        form.weight
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "weight",
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="e.g. 78"
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
                    />

                  </div>

                  <div className="sm:col-span-2">

                    <label
                      htmlFor="country"
                      className="mb-2 block text-sm text-slate-300"
                    >
                      Country
                    </label>

                    <input
                      id="country"
                      value={
                        form.country
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "country",
                          event
                            .target
                            .value
                        )
                      }
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition focus:border-emerald-500"
                    />

                  </div>

                </div>

              </div>

              <div className="border-t border-white/10 pt-7">

                <div className="mb-4 flex items-center gap-2">

                  <Building2
                    size={18}
                    className="text-emerald-400"
                  />

                  <h3 className="font-semibold">
                    Workplace
                  </h3>

                </div>

                <p className="mb-5 text-sm text-slate-500">
                  Optional. This will later be used for
                  company competitions and team
                  leaderboards.
                </p>

                <div className="grid gap-5 sm:grid-cols-2">

                  <div>

                    <label
                      htmlFor="company"
                      className="mb-2 block text-sm text-slate-300"
                    >
                      Company
                    </label>

                    <input
                      id="company"
                      value={
                        form.company
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "company",
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Company name"
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
                    />

                  </div>

                  <div>

                    <label
                      htmlFor="department"
                      className="mb-2 block text-sm text-slate-300"
                    >
                      Department / Team
                    </label>

                    <input
                      id="department"
                      value={
                        form.department
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "department",
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="e.g. Finance"
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
                    />

                  </div>

                </div>

              </div>

              <button
                type="submit"
                disabled={
                  saving
                }
                className="flex w-full items-center justify-center rounded-xl bg-emerald-500 px-6 py-3.5 font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
              >

                {saving ? (
                  <>
                    <Loader2
                      size={18}
                      className="mr-2 animate-spin"
                    />

                    Saving profile...
                  </>
                ) : (
                  <>
                    <Check
                      size={18}
                      className="mr-2"
                    />

                    Complete Setup
                  </>
                )}

              </button>

            </form>

          </section>

          <aside className="space-y-4">

            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">

              <p className="text-sm text-emerald-400">
                Almost done
              </p>

              <h3 className="mt-2 text-xl font-semibold">
                Personalise Hybrid Human
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Your profile helps organise your health
                data and calculate your training metrics.
              </p>

            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

              <p className="text-sm text-slate-500">
                After setup
              </p>

              <p className="mt-2 font-semibold">
                Connect your wearable
              </p>

              <div className="mt-4 space-y-3 text-sm text-slate-400">

                <p>
                  Apple Health
                </p>

                <p>
                  Garmin
                </p>

                <p>
                  Samsung Health
                </p>

              </div>

            </div>

          </aside>

        </div>

      </div>

    </main>
  );
}