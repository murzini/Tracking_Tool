"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { mintVisitorId } from "../../lib/prototype/checkoutVisitorId";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronLeft, CircleAlert, CreditCard, Lock, ShieldCheck, Smartphone, Star, X } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { fade } from "../../lib/prototype/fade";
import { StepPill } from "./Shared";

const FEES = {
  novaPoshta: 3.5,
  courierKyiv: 5.0,
  pickup: 0,
  cardExtra: 1.5,
  gpayExtra: 1.0,
};

const ADDRESS_OPTIONS = {
  "Fehrbelliner Strasse": {
    street: "Fehrbelliner Strasse",
    houseNumber: "22",
    zip: "10119",
    city: "Berlin",
    country: "Germany",
  },
  Torstrasse: {
    street: "Torstrasse",
    houseNumber: "98",
    zip: "10119",
    city: "Berlin",
    country: "Germany",
  },
  "Rosenthaler Strasse": {
    street: "Rosenthaler Strasse",
    houseNumber: "43",
    zip: "10178",
    city: "Berlin",
    country: "Germany",
  },
  "Prenzlauer Allee": {
    street: "Prenzlauer Allee",
    houseNumber: "15",
    zip: "10405",
    city: "Berlin",
    country: "Germany",
  },
  "Oranienburger Strasse": {
    street: "Oranienburger Strasse",
    houseNumber: "27",
    zip: "10117",
    city: "Berlin",
    country: "Germany",
  },
};

const PHONE_CODE_OPTIONS = [
  { label: "Germany +49", value: "+49" },
  { label: "Austria +43", value: "+43" },
  { label: "Switzerland +41", value: "+41" },
  { label: "Poland +48", value: "+48" },
  { label: "Netherlands +31", value: "+31" },
];

/**
 * Mobile UX: keep actions visible while scrolling (sticky) and avoid layout jumps.
 * Desktop UX: normal footer inside the card.
 *
 * Defined at module scope (not inside CheckoutFlow) so its identity is stable
 * across renders. An inline definition is a new component type every render,
 * which makes React remount the CTA button — and a remount mid-click swallows
 * the click, forcing a second click to advance the step.
 */
function ActionBar({ left, right }) {
  return (
    <div className="mt-10 lg:mt-auto lg:pt-8">
      <div
        className={
          "sticky bottom-3 z-10 rounded-2xl border bg-white/85 p-3 backdrop-blur " +
          "supports-[padding:env(safe-area-inset-bottom)]:pb-[calc(env(safe-area-inset-bottom)+12px)] " +
          "lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-0"
        }
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
          <div className="hidden h-12 lg:block">{left ? left : <div className="h-12 w-full opacity-0 pointer-events-none" />}</div>
          {left ? <div className="h-12 lg:hidden">{left}</div> : null}
          <div className="h-12">{right}</div>
        </div>
      </div>
    </div>
  );
}

// Module scope for the same stability reason as ActionBar — the CTA lives inside
// this card, so a per-render remount would swallow the first click.
function LeftCard({ children }) {
  // Benchmark height: keep all steps at least as tall as the first step (prevents jumping).
  // Extra bottom padding on mobile so the sticky ActionBar never covers content.
  return (
    <Card className="rounded-3xl shadow-sm">
      <CardContent className="flex min-h-[860px] flex-col p-6 pb-28 lg:p-8 lg:pb-8">{children}</CardContent>
    </Card>
  );
}

// Support legacy props to avoid runtime crashes.
export function CheckoutFlow({
  item,
  step,
  setStep,
  onStep,
  onBackToDetails,
  onFinish,
  onDone,
  showPersonalInfoValidation = false,
  heatmapMode = false,
  forceExpandedLayout = true,
}) {
  // Forced-open panels/accordions lengthen the form for click-anchor coverage.
  // Mouse-move/scroll views turn this off so the layout matches what visitors
  // saw at capture, since those overlays use absolute (un-anchored) coordinates.
  const expandedLayout = heatmapMode && forceExpandedLayout;
  const finish = onDone || onFinish;
  const setStageStep = setStep || onStep;
  const requiredPersonalInfoFields = ["fullName", "birthdate", "phoneCode", "phone", "street", "houseNumber", "zip"];

  const go = (next) => {
    if (typeof setStageStep === "function") setStageStep(next);
  };

  const safeStep = ["login", "personal-info", "delivery", "pay"].includes(step) ? step : "personal-info";

  const [personalInfo, setPersonalInfo] = useState({
    accountType: "private",
    fullName: "",
    birthdate: "",
    phoneCode: "",
    phone: "",
    street: "",
    houseNumber: "",
    zip: "",
    city: "Berlin",
    country: "Germany",
    color: "Black",
    waterproofCover: false,
  });
  const [personalInfoErrors, setPersonalInfoErrors] = useState(() =>
    showPersonalInfoValidation
      ? requiredPersonalInfoFields.reduce((errors, fieldName) => {
          errors[fieldName] = "Required field";
          return errors;
        }, {})
      : {}
  );
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginNameError, setLoginNameError] = useState("");

  const [delivery, setDelivery] = useState("novaPoshta");
  const [payment, setPayment] = useState("wire");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvc: "" });

  // Prevent focus loss on mobile when parent containers re-render.
  const [activeField, setActiveField] = useState(null);

  // Mobile: show/hide order summary instead of forcing a two-column layout.
  const [showSummary, setShowSummary] = useState(expandedLayout);
  const [showBirthdateHelp, setShowBirthdateHelp] = useState(expandedLayout);

  const deliveryFee =
    delivery === "novaPoshta" ? FEES.novaPoshta : delivery === "courierKyiv" ? FEES.courierKyiv : FEES.pickup;
  const payFee = payment === "card" ? FEES.cardExtra : payment === "gpay" ? FEES.gpayExtra : 0;
  const base = item ? Number(item.price || 0) : 0;
  const total = (base + deliveryFee + payFee).toFixed(2);

  const heroSrc = useMemo(() => {
    if (!item) return null;
    if (item.imageUrl) return item.imageUrl;
    const baseId = item.baseId || item.id;
    if (!baseId) return null;
    return `/backpacks/${baseId}.jpg`;
  }, [item]);

  const stepMeta = useMemo(() => {
    if (safeStep === "personal-info")
      return { n: 1, title: "Personal Information", sub: "Tell us who this order is for and how to contact you." };
    if (safeStep === "delivery")
      return { n: 2, title: "Choose Delivery", sub: "Pick the delivery method that works best for you." };
    return { n: 3, title: "Pay & Finish", sub: "Choose a payment method to complete the order." };
  }, [safeStep]);

  const StickyInput = ({ id, value, onChange, className = "", onBlur, ...rest }) => {
    const ref = useRef(null);

    useEffect(() => {
      if (activeField !== id) return;
      // If a re-render stole focus, restore it.
      if (ref.current && document.activeElement !== ref.current) {
        ref.current.focus({ preventScroll: true });
        try {
          const len = (ref.current.value || "").length;
          ref.current.setSelectionRange?.(len, len);
        } catch {}
      }
    }, [activeField, id, value]);

    return (
      <input
        ref={ref}
        value={value}
        onChange={onChange}
        onFocus={() => setActiveField(id)}
        onBlur={(e) => {
          // Only clear if we're still the active field.
          if (activeField === id) setActiveField(null);
          if (onBlur) onBlur(e);
        }}
        // Prevent parent "selectable rows" or cards from stealing focus on pointer events.
        onPointerDownCapture={(e) => e.stopPropagation()}
        onClickCapture={(e) => e.stopPropagation()}
        className={className}
        {...rest}
      />
    );
  };


  const PaymentMarks = ({ kind }) => {
    if (kind === "gpay") {
      return <img src="/payments/GogolePay.png" alt="Google Pay" className="h-9 w-auto" />;
    }
    if (kind === "card") {
      return (
        <div className="flex items-center gap-2">
          <img src="/payments/Visa.png" alt="Visa" className="h-6 w-auto" />
          <img src="/payments/Master_card.png" alt="Mastercard" className="h-6 w-auto" />
          <img src="/payments/Maestro.svg" alt="Maestro" className="h-6 w-auto" />
        </div>
      );
    }
    return null;
  };

  // Safe selectable wrapper: ignores clicks coming from inputs/buttons/labels inside.
  const SelectableRow = ({ selected, onSelect, children, heatmapId, heatmapType, heatmapLabel }) => {
    const isInteractive = (el) => el && el.closest && el.closest("input,textarea,select,button,a,label");

    return (
      <div
        role="button"
        tabIndex={0}
        data-heatmap-id={heatmapId}
        data-heatmap-type={heatmapType}
        data-heatmap-label={heatmapLabel}
        onMouseDown={(e) => {
          // Don't steal focus from inputs
          if (isInteractive(e.target)) return;
          onSelect();
        }}
        onKeyDown={(e) => {
          // Only trigger when the row itself is focused (not an inner element)
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") onSelect();
        }}
        className={`w-full rounded-3xl border px-6 py-5 text-left transition cursor-pointer select-none ${
          selected ? "border-[#0B1A33] ring-1 ring-[#0B1A33]" : "bg-white hover:bg-muted/40"
        }`}
      >
        {children}
      </div>
    );
  };

  const SummaryCard = () => {
    return (
      <Card className="rounded-3xl border-[#E5E7EB] shadow-sm">
        <CardContent className="p-5">
          <div className="text-sm font-semibold">Order summary</div>

          {item ? (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border bg-muted/30">
                {heroSrc ? <img src={heroSrc} alt={item.name} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{item.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">SKU AB-{String(item.id).padStart(6, "0")}</div>
              </div>
              <div className="text-sm font-semibold">EUR {base.toFixed(2)}</div>
            </div>
          ) : null}

          <div className="mt-5 space-y-2 border-t pt-4 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Delivery</div>
              <div className="font-semibold">EUR {deliveryFee.toFixed(2)}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Payment fee</div>
              <div className="font-semibold">EUR {payFee.toFixed(2)}</div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <div className="text-muted-foreground">Total</div>
              <div className="text-lg font-semibold">EUR {total}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const LabeledField = ({ label, required = false, children, className = "" }) => (
    <label className={`block ${className}`}>
      <div className="mb-2 text-sm font-semibold text-[#111827]">
        {label}
        {required ? " *" : ""}
      </div>
      {children}
    </label>
  );

  const baseInputClass =
    "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition placeholder:text-[#B6BDCB] focus:border-[#0B1A33] focus:ring-2 focus:ring-[#0B1A33]/10";
  const errorInputClass = "border-[#DC2626] bg-[#FEF2F2] focus:border-[#DC2626] focus:ring-[#DC2626]/10";

  const getFieldClassName = (fieldName) =>
    `${baseInputClass} ${personalInfoErrors[fieldName] ? errorInputClass : ""}`.trim();

  const setPersonalInfoField = (fieldName, value) => {
    setPersonalInfo((current) => ({ ...current, [fieldName]: value }));
    setPersonalInfoErrors((current) => {
      if (!current[fieldName]) return current;
      const next = { ...current };
      delete next[fieldName];
      return next;
    });
  };

  const handlePhoneCodeChange = (phoneCode) => {
    setPersonalInfo((current) => {
      const trimmedPhone = String(current.phone || "").trim();
      const nextPhone =
        !trimmedPhone || /^(\+\d{2,4})?$/.test(trimmedPhone)
          ? phoneCode
          : trimmedPhone.startsWith(phoneCode)
            ? trimmedPhone
            : `${phoneCode} ${trimmedPhone.replace(/^\+\d{2,4}\s*/, "")}`.trim();

      return {
        ...current,
        phoneCode,
        phone: nextPhone,
      };
    });

    setPersonalInfoErrors((current) => {
      const next = { ...current };
      delete next.phoneCode;
      delete next.phone;
      return next;
    });
  };

  const handleStreetChange = (street) => {
    const selectedAddress = ADDRESS_OPTIONS[street];

    if (!selectedAddress) {
      setPersonalInfo((current) => ({
        ...current,
        street,
        houseNumber: "",
        zip: "",
        city: "Berlin",
        country: "Germany",
      }));
    } else {
      setPersonalInfo((current) => ({
        ...current,
        street: selectedAddress.street,
        houseNumber: selectedAddress.houseNumber,
        zip: selectedAddress.zip,
        city: selectedAddress.city,
        country: selectedAddress.country,
      }));
    }

    setPersonalInfoErrors((current) => {
      const next = { ...current };
      delete next.street;
      delete next.houseNumber;
      delete next.zip;
      return next;
    });
  };

  const validatePersonalInfo = () => {
    const nextErrors = {};

    requiredPersonalInfoFields.forEach((fieldName) => {
      if (!String(personalInfo[fieldName] || "").trim()) {
        nextErrors[fieldName] = "Required field";
      }
    });

    if (personalInfo.birthdate && !/^\d{2}\.\d{2}\.\d{4}$/.test(personalInfo.birthdate.trim())) {
      nextErrors.birthdate = "Use DD.MM.YYYY";
    }

    setPersonalInfoErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLoginContinue = () => {
    if (!loginName.trim()) {
      setLoginNameError("Required field");
      return;
    }
    mintVisitorId();
    go("personal-info");
  };

  const handleContinueToDelivery = () => {
    if (!validatePersonalInfo()) return;
    go("delivery");
  };

  const FieldError = ({ fieldName }) =>
    personalInfoErrors[fieldName] ? <div data-field-error className="mt-2 text-xs font-medium text-[#DC2626]">{personalInfoErrors[fieldName]}</div> : null;

  const reviewCards = [
    {
      name: "Anja M.",
      age: "16 hours ago",
      title: "Simple order process",
      body: "The checkout was straightforward and the delivery information felt clear from the start.",
    },
    {
      name: "Carmen W.",
      age: "20 hours ago",
      title: "Smooth experience",
      body: "I was skeptical at first, but the order flow was easy to understand and very fast.",
    },
    {
      name: "Christiane K.",
      age: "1 day ago",
      title: "Everything worked well",
      body: "From product selection to payment, the process felt clear and well structured.",
    },
    {
      name: "Denny B.",
      age: "1 day ago",
      title: "Fast delivery updates",
      body: "The delivery step explained everything I needed before I placed the order.",
    },
    {
      name: "Kinga S.",
      age: "2 days ago",
      title: "Very easy checkout",
      body: "I completed the form quickly and liked having the summary visible on the side.",
    },
    {
      name: "Marta L.",
      age: "2 days ago",
      title: "Helpful order flow",
      body: "The page felt trustworthy and the step sequence made sense the whole way through.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8" data-checkout-heatmap-surface="personal-info-step">
      <motion.div {...fade} transition={{ duration: 0.25 }}>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StepPill active={safeStep === "personal-info"} data-heatmap-id="nav:step-personal-information" data-heatmap-type="nav">Personal Information</StepPill>
          <StepPill active={safeStep === "delivery"} data-heatmap-id="nav:step-choose-delivery" data-heatmap-type="nav">Choose Delivery</StepPill>
          <StepPill active={safeStep === "pay"} data-heatmap-id="nav:step-pay-finish" data-heatmap-type="nav">Pay & Finish</StepPill>
        </div>

        {/* MOBILE: Summary is optional (toggle), so the main flow stays single-column */}
        <div className="mt-4 lg:hidden">
          <button
            type="button"
            data-heatmap-id="toggle:order-summary"
            data-heatmap-type="toggle"
            onClick={() => setShowSummary((v) => !v)}
            className="w-full rounded-2xl border bg-white px-4 py-3 text-left text-sm flex items-center justify-between"
          >
            <span className="font-semibold">Order summary</span>
            <span className="text-muted-foreground">{showSummary ? "Hide" : `Show - EUR ${total}`}</span>
          </button>

          {showSummary ? (
            <div className="mt-4">
              <SummaryCard />
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* MAIN COLUMN */}
          <div className="col-span-12 lg:col-span-7">
            {safeStep === "login" ? (
              <LeftCard>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">Enter your name to continue to checkout.</p>

                <div className="mt-8 space-y-6">
                  <LabeledField label="Name" required>
                    <StickyInput
                      id="login_name"
                      value={loginName}
                      onChange={(e) => {
                        setLoginName(e.target.value);
                        if (loginNameError) setLoginNameError("");
                      }}
                      placeholder="Your name"
                      className={`${baseInputClass}${loginNameError ? ` ${errorInputClass}` : ""}`}
                    />
                    {loginNameError ? (
                      <div data-field-error className="mt-2 text-xs font-medium text-[#DC2626]">{loginNameError}</div>
                    ) : null}
                  </LabeledField>

                  <LabeledField label="Password">
                    <StickyInput
                      id="login_password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Password (optional)"
                      className={baseInputClass}
                    />
                  </LabeledField>
                </div>

                <ActionBar
                  right={
                    <Button
                      className="h-12 w-full rounded-2xl bg-[#0B1A33] hover:bg-[#0B1A33]/90"
                      onClick={handleLoginContinue}
                    >
                      Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  }
                />
              </LeftCard>
            ) : null}

            {safeStep === "personal-info" ? (
              <LeftCard>
                <div className="text-xs text-muted-foreground">Checkout - Step {stepMeta.n}</div>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight">{stepMeta.title}</h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">Provide your details to continue to delivery.</p>

                <div className="mt-6 inline-flex items-center gap-3">
                  {[
                    { value: "private", label: "Private" },
                    { value: "company", label: "Company" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      data-heatmap-id={`toggle:${option.value}`}
                      data-heatmap-type="toggle"
                      onClick={() => setPersonalInfo((v) => ({ ...v, accountType: option.value }))}
                      className={`rounded-full border px-6 py-3 text-sm font-semibold transition ${
                        personalInfo.accountType === option.value
                          ? "border-[#0B1A33] bg-[#0B1A33] text-white"
                          : "border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F3F4F6]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="mt-8 space-y-8">
                  <div className="grid gap-4 md:grid-cols-2">
                    <LabeledField label="Name" required>
                      <StickyInput
                        id="personal_full_name"
                        data-heatmap-id="text:name"
                        data-heatmap-label="Name"
                        value={personalInfo.fullName}
                        onChange={(e) => setPersonalInfoField("fullName", e.target.value)}
                        placeholder="Your name"
                        className={getFieldClassName("fullName")}
                      />
                      <FieldError fieldName="fullName" />
                    </LabeledField>
                    <div className="relative">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                        <span>Birthdate *</span>
                        <div className="relative">
                          <button
                            type="button"
                            data-heatmap-id="tooltip:birthdate-help"
                            data-heatmap-type="tooltip"
                            data-heatmap-label="Birthdate help"
                            onClick={() => setShowBirthdateHelp((value) => !value)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#D1D5DB] text-[#9CA3AF] transition hover:border-[#B6BDCB] hover:text-[#6B7280]"
                            aria-label="Show birthdate help"
                            aria-expanded={showBirthdateHelp}
                          >
                            <CircleAlert className="h-3.5 w-3.5" />
                          </button>
                          {showBirthdateHelp ? (
                            <div
                              data-heatmap-id="tooltip-content:birthdate-help"
                              data-heatmap-type="tooltip-content"
                              data-heatmap-label="Birthdate help tooltip"
                              className="absolute left-full top-1/2 z-10 ml-2 w-[220px] -translate-y-1/2 rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2 shadow-lg"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-[11px] leading-relaxed text-[#6B7280]">
                                  Enter your birthdate in the format DD.MM.YYYY.
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowBirthdateHelp(false)}
                                  className="mt-0.5 text-[#9CA3AF] transition hover:text-[#6B7280]"
                                  aria-label="Close birthdate help"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="relative">
                        <StickyInput
                          id="personal_birthdate"
                          data-heatmap-id="date:birthdate"
                          data-heatmap-type="date"
                          data-heatmap-label="Birthdate"
                          value={personalInfo.birthdate}
                          onChange={(e) => setPersonalInfoField("birthdate", e.target.value)}
                          placeholder="TT.MM.JJJJ"
                          className={getFieldClassName("birthdate")}
                        />
                      </div>
                      <FieldError fieldName="birthdate" />
                    </div>
                  </div>

                  <div>
                    <LabeledField label="Phone number" required>
                      <div className="grid gap-3 md:grid-cols-[108px_1fr]">
                        <div className="relative">
                          <select
                            data-heatmap-id="dropdown:phone-code"
                            data-heatmap-label="Phone code"
                            value={personalInfo.phoneCode}
                            onChange={(e) => handlePhoneCodeChange(e.target.value)}
                            className={`${getFieldClassName("phoneCode")} appearance-none pr-10`}
                          >
                            <option value="">Select code</option>
                            {PHONE_CODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                        </div>
                        <StickyInput
                          id="personal_phone"
                          data-heatmap-id="tel:phone-number"
                          data-heatmap-type="tel"
                          data-heatmap-label="Phone number"
                          value={personalInfo.phone}
                          onChange={(e) => setPersonalInfoField("phone", e.target.value)}
                          placeholder="1111"
                          className={getFieldClassName("phone")}
                          inputMode="tel"
                        />
                      </div>
                      <FieldError fieldName="phoneCode" />
                      {!personalInfoErrors.phoneCode ? <FieldError fieldName="phone" /> : null}
                    </LabeledField>
                  </div>

                  <div>
                    <LabeledField label="Street" required>
                      <div className="relative">
                        <select
                          data-heatmap-id="dropdown:street"
                          data-heatmap-label="Street"
                          value={personalInfo.street}
                          onChange={(e) => handleStreetChange(e.target.value)}
                          className={`${getFieldClassName("street")} appearance-none pr-10`}
                        >
                          <option value="">Select Berlin address</option>
                          <option value="Fehrbelliner Strasse">Fehrbelliner Strasse</option>
                          <option value="Torstrasse">Torstrasse</option>
                          <option value="Rosenthaler Strasse">Rosenthaler Strasse</option>
                          <option value="Prenzlauer Allee">Prenzlauer Allee</option>
                          <option value="Oranienburger Strasse">Oranienburger Strasse</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                      </div>
                      <FieldError fieldName="street" />
                    </LabeledField>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <LabeledField label="House number" required>
                      <StickyInput
                        id="personal_house_number"
                        data-heatmap-id="text:house-number"
                        data-heatmap-label="House number"
                        value={personalInfo.houseNumber}
                        onChange={(e) => setPersonalInfoField("houseNumber", e.target.value)}
                        className={getFieldClassName("houseNumber")}
                      />
                      <FieldError fieldName="houseNumber" />
                    </LabeledField>
                    <LabeledField label="ZIP" required>
                      <StickyInput
                        id="personal_zip"
                        data-heatmap-id="text:zip"
                        data-heatmap-label="ZIP"
                        value={personalInfo.zip}
                        onChange={(e) => setPersonalInfoField("zip", e.target.value)}
                        className={getFieldClassName("zip")}
                      />
                      <FieldError fieldName="zip" />
                    </LabeledField>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <LabeledField label="City" required>
                      <div data-heatmap-id="display:city" data-heatmap-type="display" data-heatmap-label="City" className="rounded-2xl bg-[#ECEFF3] px-4 py-3 text-sm text-[#374151]">{personalInfo.city}</div>
                    </LabeledField>
                    <LabeledField label="Country" required>
                      <div data-heatmap-id="display:country" data-heatmap-type="display" data-heatmap-label="Country" className="rounded-2xl bg-[#ECEFF3] px-4 py-3 text-sm text-[#374151]">{personalInfo.country}</div>
                    </LabeledField>
                  </div>

                  <LabeledField label="Color">
                    <div className="flex flex-wrap gap-3">
                      {["Black", "Sand", "Forest", "Navy"].map((color) => {
                        const isActive = personalInfo.color === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            data-heatmap-id={`radio:color-${color.toLowerCase()}`}
                            data-heatmap-type="radio"
                            data-heatmap-label={color}
                            onClick={() => setPersonalInfo((v) => ({ ...v, color }))}
                            className={`inline-flex min-w-[88px] items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition ${
                              isActive
                                ? "border-[#0B1A33] text-[#0B1A33] shadow-[inset_0_0_0_1px_#0B1A33]"
                                : "border-[#E5E7EB] text-[#6B7280] hover:border-[#CBD5E1]"
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                isActive ? "border-[#0B1A33]" : "border-[#D1D5DB]"
                              }`}
                            >
                              {isActive ? <span className="h-2 w-2 rounded-full bg-[#0B1A33]" /> : null}
                            </span>
                            {color}
                          </button>
                        );
                      })}
                    </div>
                  </LabeledField>

                  <button
                    type="button"
                    data-heatmap-id="checkbox:waterproof-cover"
                    data-heatmap-type="checkbox"
                    data-heatmap-label="Waterproof cover"
                    onClick={() => setPersonalInfo((v) => ({ ...v, waterproofCover: !v.waterproofCover }))}
                    className="flex w-full items-center justify-between rounded-3xl border border-[#E5E7EB] bg-white px-6 py-5 text-left hover:bg-[#FAFAFA]"
                  >
                    <div>
                      <div className="text-sm font-semibold">Add waterproof cover</div>
                      <div className="mt-1 text-xs text-muted-foreground">Extra protection for rain.</div>
                    </div>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        personalInfo.waterproofCover ? "border-[#0B1A33] bg-[#0B1A33]" : "border-[#E5E7EB] bg-white"
                      }`}
                    >
                      {personalInfo.waterproofCover ? <span className="h-2 w-2 rounded-sm bg-white" /> : null}
                    </div>
                  </button>

                  <Accordion type="single" collapsible forceAllOpen={expandedLayout} className="space-y-0 overflow-hidden rounded-[1.75rem] border border-[#E5E7EB] bg-white">
                    {[
                      {
                        value: "price",
                        heatmapId: "accordion:price-calculated",
                        title: "How is my price calculated?",
                        body: "Your total combines the base backpack price, selected delivery method, and any payment fee shown in the summary.",
                      },
                      {
                        value: "handover",
                        heatmapId: "accordion:handover-work",
                        title: "How does the handover work?",
                        body: "We confirm your contact details first, then you choose delivery. Handover timing depends on the selected delivery option.",
                      },
                      {
                        value: "benefits",
                        heatmapId: "accordion:main-benefits",
                        title: "What are the main benefits?",
                        body: "You can review your order at every step, keep the price visible, and complete checkout without creating an account.",
                      },
                    ].map((entry, index) => (
                      <AccordionItem key={entry.value} value={entry.value} className={index > 0 ? "border-t border-[#E5E7EB]" : ""}>
                        <AccordionTrigger data-heatmap-id={entry.heatmapId} data-heatmap-type="accordion" className="px-5 py-5 text-left text-sm font-semibold">
                          {entry.title}
                        </AccordionTrigger>
                        <AccordionContent className="px-5 pb-5 text-sm text-muted-foreground">
                          {entry.body}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  <div data-heatmap-id="area:reviews" data-heatmap-type="area" data-heatmap-label="Personalised reviews" className="rounded-[2rem] border border-[#E5E7EB] bg-[#F5F7FA] p-5">
                    <div className="text-center">
                      <div className="text-4xl font-semibold tracking-tight text-[#111827]">Excellent</div>
                      <div className="mt-3 flex justify-center gap-1">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <div key={idx} className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#00B67A] text-white">
                            <Star className="h-3.5 w-3.5 fill-current" />
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Rated 4.3 out of 5 based on <span className="font-semibold text-[#00B67A]">17,260 reviews</span> on Trustpilot
                      </div>
                    </div>

                    <div className="mt-6 max-h-[360px] overflow-y-auto pr-2">
                      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                        {reviewCards.map((review) => (
                          <div key={`${review.name}-${review.title}`} className="rounded-3xl border border-[#E5E7EB] bg-white p-4">
                            <div className="flex gap-1 text-[#00B67A]">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                              ))}
                            </div>
                            <div className="mt-3 text-xs text-[#6B7280]">
                              {review.name}, {review.age}
                            </div>
                            <div className="mt-2 text-sm font-semibold">{review.title}</div>
                            <div className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{review.body}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <ActionBar
                  left={null}
                  right={
                    <Button
                      data-heatmap-id="cta:choose-delivery"
                      data-heatmap-type="cta"
                      data-heatmap-label="Choose delivery"
                      className="h-12 w-full rounded-2xl bg-[#0B1A33] hover:bg-[#0B1A33]/90"
                      onClick={handleContinueToDelivery}
                    >
                      Choose delivery <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  }
                />
              </LeftCard>
            ) : null}

            {safeStep === "delivery" ? (
              <LeftCard>
                <div className="text-xs text-muted-foreground">Checkout - Step {stepMeta.n}</div>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight">{stepMeta.title}</h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">{stepMeta.sub}</p>

                <div className="mt-6 space-y-4">
                  <button
                    type="button"
                    data-heatmap-id="radio:delivery-novaposhta"
                    data-heatmap-type="radio"
                    data-heatmap-label="NovaPoshta"
                    onClick={() => setDelivery("novaPoshta")}
                    className={`w-full rounded-3xl border px-6 py-5 text-left transition ${
                      delivery === "novaPoshta"
                        ? "bg-[#0B1A33] text-white border-[#0B1A33]"
                        : "bg-white hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <img
                          src="/delivery/Nova_Poshta_2022_logo.png"
                          alt="Nova Poshta"
                          className="mt-1 h-7 w-auto rounded-sm bg-white p-1"
                        />
                        <div>
                          <div className="text-sm font-semibold">NovaPoshta</div>
                          <div
                            className={`mt-1 text-xs ${
                              delivery === "novaPoshta" ? "text-white/80" : "text-muted-foreground"
                            }`}
                          >
                            To your chosen branch / parcel locker.
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">EUR {FEES.novaPoshta.toFixed(2)}</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    data-heatmap-id="radio:delivery-courier-kyiv"
                    data-heatmap-type="radio"
                    data-heatmap-label="Our courier delivery"
                    onClick={() => setDelivery("courierKyiv")}
                    className={`w-full rounded-3xl border px-6 py-5 text-left transition ${
                      delivery === "courierKyiv"
                        ? "bg-[#0B1A33] text-white border-[#0B1A33]"
                        : "bg-white hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold">Our courier delivery</div>
                        <div
                          className={`mt-1 text-xs ${
                            delivery === "courierKyiv" ? "text-white/80" : "text-muted-foreground"
                          }`}
                        >
                          Kyiv only.
                        </div>
                      </div>
                      <div className="text-sm font-semibold">EUR {FEES.courierKyiv.toFixed(2)}</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    data-heatmap-id="radio:delivery-pickup"
                    data-heatmap-type="radio"
                    data-heatmap-label="Pick-up from our office in Kyiv"
                    onClick={() => setDelivery("pickup")}
                    className={`w-full rounded-3xl border px-6 py-5 text-left transition ${
                      delivery === "pickup" ? "bg-[#0B1A33] text-white border-[#0B1A33]" : "bg-white hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold">Pick-up from our office in Kyiv</div>
                        <div
                          className={`mt-1 text-xs ${
                            delivery === "pickup" ? "text-white/80" : "text-muted-foreground"
                          }`}
                        >
                          Schedule after purchase.
                        </div>
                      </div>
                      <div className="text-sm font-semibold">Free</div>
                    </div>
                  </button>
                </div>

                <ActionBar
                  left={
                    <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => go("personal-info")}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  }
                  right={
                    <Button
                      data-heatmap-id="cta:pay-finish"
                      data-heatmap-type="cta"
                      data-heatmap-label="Pay & Finish"
                      className="h-12 w-full rounded-2xl bg-[#0B1A33] hover:bg-[#0B1A33]/90"
                      onClick={() => go("pay")}
                    >
                      Pay & Finish <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  }
                />
              </LeftCard>
            ) : null}

            {safeStep === "pay" ? (
              <LeftCard>
                <div className="text-xs text-muted-foreground">Checkout - Step {stepMeta.n}</div>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight">{stepMeta.title}</h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">{stepMeta.sub}</p>

                <div className="mt-6 space-y-4">
                  <SelectableRow
                    selected={payment === "card"}
                    onSelect={() => setPayment("card")}
                    heatmapId="radio:pay-card"
                    heatmapType="radio"
                    heatmapLabel="Credit Card"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-10 w-10 rounded-2xl border bg-white flex items-center justify-center">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold">Credit Card</div>
                          <div className="mt-2">
                            <PaymentMarks kind="card" />
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">+EUR {FEES.cardExtra.toFixed(2)}</div>
                    </div>
                  </SelectableRow>

                  {payment === "card" || expandedLayout ? (
                    <div className="rounded-3xl border bg-white px-6 py-5">
                      <div className="grid gap-3">
                        <StickyInput id="card_number"
                          value={card.number}
                          onChange={(e) => setCard((v) => ({ ...v, number: e.target.value }))}
                          placeholder="Card number"
                          className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0B1A33]/30"
                          inputMode="numeric"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <StickyInput id="card_expiry"
                            value={card.expiry}
                            onChange={(e) => setCard((v) => ({ ...v, expiry: e.target.value }))}
                            placeholder="MM/YY"
                            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0B1A33]/30"
                            inputMode="numeric"
                          />
                          <StickyInput id="card_cvc"
                            value={card.cvc}
                            onChange={(e) => setCard((v) => ({ ...v, cvc: e.target.value }))}
                            placeholder="CVC"
                            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0B1A33]/30"
                            inputMode="numeric"
                          />
                        </div>
                        <StickyInput id="card_name"
                          value={card.name}
                          onChange={(e) => setCard((v) => ({ ...v, name: e.target.value }))}
                          placeholder="Name on card"
                          className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0B1A33]/30"
                        />
                      </div>
                    </div>
                  ) : null}

                  <SelectableRow
                    selected={payment === "gpay"}
                    onSelect={() => setPayment("gpay")}
                    heatmapId="radio:pay-gpay"
                    heatmapType="radio"
                    heatmapLabel="Google Pay"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-10 w-10 rounded-2xl border bg-white flex items-center justify-center">
                          <Smartphone className="h-5 w-5" />
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="text-sm font-semibold">Google Pay</div>

                          <div className="inline-flex items-center">
                            <div className="rounded-md border bg-white px-3 py-2 shadow-sm">
                              <PaymentMarks kind="gpay" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground">+EUR {FEES.gpayExtra.toFixed(2)}</div>
                    </div>
                  </SelectableRow>

                  <SelectableRow
                    selected={payment === "wire"}
                    onSelect={() => setPayment("wire")}
                    heatmapId="radio:pay-wire"
                    heatmapType="radio"
                    heatmapLabel="Wire transfer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-10 w-10 rounded-2xl border bg-white flex items-center justify-center">
                          <ShieldCheck className="h-5 w-5" />
                        </div>

                        <div className="flex-1">
                          <div className="text-sm font-semibold">Wire transfer</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            We'll send banking details to your email and wait up to 3 business days before finalizing the order.
                          </div>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground">No extra fee</div>
                    </div>
                  </SelectableRow>

                  {payment === "wire" || expandedLayout ? (
                    <div className="rounded-3xl border bg-white px-6 py-5">
                      <div className="text-xs text-muted-foreground">Email address</div>
                      <StickyInput id="wire_email"
                        value={personalInfo.email}
                        onChange={(e) => setPersonalInfo((v) => ({ ...v, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0B1A33]/30"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 text-xs text-muted-foreground">Charges are simulated in the prototype.</div>

                <ActionBar
                  left={
                    <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => go("delivery")}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  }
                  right={
                    <Button
                      data-heatmap-id="cta:pay"
                      data-heatmap-type="cta"
                      data-heatmap-label="Pay"
                      className="h-12 w-full rounded-2xl bg-[#0B1A33] hover:bg-[#0B1A33]/90"
                      onClick={finish}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Pay EUR {total} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  }
                />
              </LeftCard>
            ) : null}
          </div>

          {/* DESKTOP SUMMARY COLUMN ONLY */}
          <div className="hidden lg:col-span-5 lg:block">
            <div className="h-full">
              <div aria-hidden="true" className="pointer-events-none select-none opacity-0">
                <SummaryCard />
              </div>
              <div
                data-heatmap-id="area:order-summary"
                data-heatmap-type="area"
                data-heatmap-label="Order summary"
                className="fixed top-24 z-30 hidden max-h-[calc(100vh-7rem)] w-[min(22rem,calc(100vw-3rem))] overflow-y-auto lg:block lg:right-[max(1rem,calc((100vw-72rem)/2+1rem))]"
              >
                <SummaryCard />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
