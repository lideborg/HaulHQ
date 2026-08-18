"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/app/[handle]/profile-actions";
import { ftInToCm, lbsToKg } from "@/lib/sizing";
import type { Measurements, ShippingAddress } from "@/lib/types";

const label = "block text-[9px] uppercase tracking-widest text-neutral-400 mb-1";
const input =
  "w-full border border-neutral-300 px-2 py-1.5 text-sm focus:border-black focus:outline-none";
const chip = (on: boolean) =>
  `border px-2 py-1 text-[10px] ${on ? "border-black bg-black text-white" : "border-neutral-300 text-neutral-600 hover:border-black"}`;

export function ProfileForm({
  handle,
  mode,
  initialAddress,
  initialMeasurements,
}: {
  handle: string;
  mode: "welcome" | "profile";
  initialAddress: ShippingAddress | null;
  initialMeasurements: Measurements | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addr, setAddr] = useState<ShippingAddress>(initialAddress ?? { country: "US" });
  const m0 = initialMeasurements ?? {};
  const [gender, setGender] = useState(m0.gender ?? "");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ftin">("cm");
  const [heightCm, setHeightCm] = useState(m0.height_cm?.toString() ?? "");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [weight, setWeight] = useState(m0.weight_kg?.toString() ?? "");
  const [jeans, setJeans] = useState(m0.jeans_waist_in?.toString() ?? "");
  const [waistUnit, setWaistUnit] = useState<"in" | "cm">("in");
  // Legacy rows saved plain "us" with the gender field disambiguating; surface
  // those as the explicit US Women's option so what's shown matches the math.
  const [shoeSystem, setShoeSystem] = useState<"us" | "us-w" | "eu">(
    m0.shoe?.system === "us" && m0.gender === "female" ? "us-w" : (m0.shoe?.system ?? "us"),
  );
  const [shoeVal, setShoeVal] = useState(m0.shoe?.value?.toString() ?? "");
  const [fitPref, setFitPref] = useState(m0.fit_pref ?? "");
  const [chest, setChest] = useState(m0.explicit?.chest_cm?.toString() ?? "");
  const [waistM, setWaistM] = useState(m0.explicit?.waist_cm?.toString() ?? "");
  const [shoulder, setShoulder] = useState(m0.explicit?.shoulder_cm?.toString() ?? "");
  const [foot, setFoot] = useState(m0.explicit?.foot_cm?.toString() ?? "");

  function collect(): { address: ShippingAddress | null; measurements: Measurements | null } {
    const hasAddr = Object.values(addr).some((v) => (v ?? "").toString().trim() !== "");
    const num = (s: string) => (s.trim() === "" || Number.isNaN(+s) ? undefined : +s);
    const h =
      heightUnit === "cm"
        ? num(heightCm)
        : num(heightFt) != null
          ? ftInToCm(num(heightFt)!, num(heightIn) ?? 0)
          : undefined;
    const w = weightUnit === "kg" ? num(weight) : num(weight) != null ? lbsToKg(num(weight)!) : undefined;
    // Waist is stored canonically in inches; convert if entered in cm.
    const waistIn =
      waistUnit === "in"
        ? num(jeans)
        : num(jeans) != null
          ? Math.round((num(jeans)! / 2.54) * 10) / 10
          : undefined;
    const explicit = {
      ...(num(chest) != null && { chest_cm: num(chest) }),
      ...(num(waistM) != null && { waist_cm: num(waistM) }),
      ...(num(shoulder) != null && { shoulder_cm: num(shoulder) }),
      ...(num(foot) != null && { foot_cm: num(foot) }),
    };
    const meas: Measurements = {
      ...(gender && { gender: gender as Measurements["gender"] }),
      ...(h != null && { height_cm: h }),
      ...(w != null && { weight_kg: w }),
      ...(waistIn != null && { jeans_waist_in: waistIn }),
      ...(num(shoeVal) != null && { shoe: { system: shoeSystem, value: num(shoeVal)! } }),
      ...(fitPref && { fit_pref: fitPref as Measurements["fit_pref"] }),
      ...(Object.keys(explicit).length > 0 && { explicit }),
    };
    return {
      address: hasAddr ? addr : null,
      measurements: Object.keys(meas).length > 0 ? meas : null,
    };
  }

  function submit(skip: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await saveProfile(skip ? { address: null, measurements: null } : collect());
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
      if (mode === "welcome") router.push(`/${handle}/shop`);
      else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    });
  }

  // Height keeps separate state per unit; back-fill on toggle so a saved value
  // in the other unit isn't silently dropped when the user saves without retyping.
  function toggleHeightUnit() {
    const num = (s: string) => (s.trim() === "" || Number.isNaN(+s) ? undefined : +s);
    if (heightUnit === "cm") {
      const cm = num(heightCm);
      if (cm != null && num(heightFt) == null && num(heightIn) == null) {
        const totalIn = cm / 2.54;
        let ftPart = Math.floor(totalIn / 12);
        let inPart = Math.round(totalIn % 12);
        if (inPart === 12) { ftPart += 1; inPart = 0; }
        setHeightFt(ftPart.toString());
        setHeightIn(inPart.toString());
      }
      setHeightUnit("ftin");
    } else {
      const ft = num(heightFt);
      if (ft != null && num(heightCm) == null) {
        setHeightCm(ftInToCm(ft, num(heightIn) ?? 0).toString());
      }
      setHeightUnit("cm");
    }
  }

  // Convert the entered value when switching units so the number keeps meaning.
  function toggleWaistUnit() {
    const n = jeans.trim() === "" || Number.isNaN(+jeans) ? undefined : +jeans;
    if (waistUnit === "in") {
      if (n != null) setJeans((Math.round(n * 2.54 * 10) / 10).toString());
      setWaistUnit("cm");
    } else {
      if (n != null) setJeans((Math.round((n / 2.54) * 10) / 10).toString());
      setWaistUnit("in");
    }
  }

  const setA = (k: keyof ShippingAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddr((a) => ({ ...a, [k]: e.target.value }));

  return (
    <div className="space-y-10">
      {/* ADDRESS */}
      <section>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-widest">Delivery address</h2>
        <p className="mb-4 text-xs text-neutral-500">
          For easy delivery, enter your address and we&apos;ll save it for your orders.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><span className={label}>Street address</span>
            <input className={input} value={addr.line1 ?? ""} onChange={setA("line1")} /></div>
          <div className="sm:col-span-2"><span className={label}>Apt / unit (optional)</span>
            <input className={input} value={addr.line2 ?? ""} onChange={setA("line2")} /></div>
          <div><span className={label}>City</span>
            <input className={input} value={addr.city ?? ""} onChange={setA("city")} /></div>
          <div><span className={label}>State / region</span>
            <input className={input} value={addr.region ?? ""} onChange={setA("region")} /></div>
          <div><span className={label}>ZIP / postal code</span>
            <input className={input} value={addr.postal ?? ""} onChange={setA("postal")} /></div>
          <div><span className={label}>Country</span>
            <input className={input} value={addr.country ?? ""} onChange={setA("country")} /></div>
          <div className="sm:col-span-2"><span className={label}>Phone</span>
            <input className={input} value={addr.phone ?? ""} onChange={setA("phone")} /></div>
        </div>
      </section>

      {/* SIZING */}
      <section>
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-widest">
          Sizing <span className="font-normal text-neutral-400">(optional)</span>
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-neutral-500">
          Sizing on these pieces can run a little off from what you&apos;re used to.
          Enter your details and we&apos;ll guide you to the most accurate size on
          every product. If you know your real measurements, even better.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><span className={label}>Gender</span>
            <div className="flex gap-1.5">
              {(["male", "female", "na"] as const).map((g) => (
                <button type="button" key={g} onClick={() => setGender(gender === g ? "" : g)} className={chip(gender === g)}>
                  {g === "na" ? "prefer not to say" : g}
                </button>
              ))}
            </div>
          </div>
          <div><span className={label}>Fit preference</span>
            <div className="flex gap-1.5">
              {(["slim", "true", "oversized"] as const).map((f) => (
                <button type="button" key={f} onClick={() => setFitPref(fitPref === f ? "" : f)} className={chip(fitPref === f)}>
                  {f === "true" ? "true to size" : f}
                </button>
              ))}
            </div>
          </div>
          <div><span className={label}>
              Height{" "}
              <button type="button" className="underline" onClick={toggleHeightUnit}>
                {heightUnit === "cm" ? "cm · switch to ft/in" : "ft/in · switch to cm"}
              </button></span>
            {heightUnit === "cm" ? (
              <input className={input} inputMode="decimal" placeholder="180" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            ) : (
              <div className="flex gap-2">
                <input className={input} inputMode="numeric" placeholder="5 ft" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} />
                <input className={input} inputMode="numeric" placeholder="11 in" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
              </div>
            )}
          </div>
          <div><span className={label}>
              Weight{" "}
              <button type="button" className="underline" onClick={() => setWeightUnit(weightUnit === "kg" ? "lbs" : "kg")}>
                {weightUnit} · switch to {weightUnit === "kg" ? "lbs" : "kg"}
              </button></span>
            <input className={input} inputMode="decimal" placeholder={weightUnit === "kg" ? "75" : "165"} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div><span className={label}>
              Waist size{" "}
              <button type="button" className="underline" onClick={toggleWaistUnit}>
                {waistUnit} · switch to {waistUnit === "in" ? "cm" : "in"}
              </button></span>
            <input className={input} inputMode="decimal" placeholder={waistUnit === "in" ? "32" : "81"} value={jeans} onChange={(e) => setJeans(e.target.value)} /></div>
          <div><span className={label}>Shoe size</span>
            <div className="flex gap-2">
              <select className={input + " w-28"} value={shoeSystem} onChange={(e) => setShoeSystem(e.target.value as "us" | "us-w" | "eu")}>
                <option value="us">US Men&rsquo;s</option>
                <option value="us-w">US Women&rsquo;s</option>
                <option value="eu">EU</option>
              </select>
              <input className={input} inputMode="decimal" placeholder={shoeSystem === "us" ? "9" : shoeSystem === "us-w" ? "7.5" : "42"} value={shoeVal} onChange={(e) => setShoeVal(e.target.value)} />
            </div>
            <p className="mt-1 text-[10px] text-neutral-400">
              US sizes differ for men and women, so pick the scale your size is in.
            </p>
          </div>
        </div>

        <details className="group mt-5 border-t border-neutral-100 pt-3">
          <summary className="cursor-pointer list-none text-[10px] uppercase tracking-widest text-neutral-500 hover:text-black">
            I know my measurements <span className="text-neutral-300 group-open:hidden">+</span>
            <span className="hidden text-neutral-300 group-open:inline">−</span>
          </summary>
          <p className="mt-2 text-[11px] text-neutral-400">
            These override the estimates — measure over a thin layer, tape snug but not tight.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><span className={label}>Chest (cm) — around the widest part</span>
              <input className={input} inputMode="decimal" value={chest} onChange={(e) => setChest(e.target.value)} /></div>
            <div><span className={label}>Waist (cm) — around the narrowest part</span>
              <input className={input} inputMode="decimal" value={waistM} onChange={(e) => setWaistM(e.target.value)} /></div>
            <div><span className={label}>Shoulder (cm) — seam to seam across the back</span>
              <input className={input} inputMode="decimal" value={shoulder} onChange={(e) => setShoulder(e.target.value)} /></div>
            <div><span className={label}>Foot length (cm) — heel to longest toe</span>
              <input className={input} inputMode="decimal" value={foot} onChange={(e) => setFoot(e.target.value)} /></div>
          </div>
        </details>
      </section>

      <div className="space-y-3">
        <button onClick={() => submit(false)} disabled={pending}
          className="w-full bg-black py-2.5 text-[10px] uppercase tracking-widest text-white disabled:opacity-50">
          {pending ? "Saving…" : mode === "welcome" ? "Save & enter shop" : saved ? "Saved ✓" : "Save changes"}
        </button>
        {mode === "welcome" && (
          <button onClick={() => submit(true)} disabled={pending}
            className="block w-full text-center text-[10px] uppercase tracking-widest text-neutral-400 underline hover:text-black">
            Skip for now
          </button>
        )}
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    </div>
  );
}
