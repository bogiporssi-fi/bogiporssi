"use client";

import React, { useEffect, useState } from "react";
import { getTeamLogoPath, parseTeamLogoId, publicTeamLogoUrl } from "../../lib/teamLogos";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface TeamLogoProps {
  /** Supabase Storage -polku bucketissa team-logos (esim. uuid/logo.png) */
  logoPath?: string | null;
  /** Vanha esilogo-id (bp-1 …), näytetään vain jos logoPath puuttuu */
  logoId?: string | null;
  fallbackName: string;
  size?: "md" | "sm";
  className?: string;
}

/**
 * Näyttää oman kuvan, vanhan esilogon tai nimikirjaimet.
 */
export default function TeamLogo({
  logoPath,
  logoId,
  fallbackName,
  size = "md",
  className = "",
}: TeamLogoProps) {
  const [imgBroken, setImgBroken] = useState(false);
  const presetId = parseTeamLogoId(logoId);
  const customUrl =
    logoPath && typeof logoPath === "string" && logoPath.length > 0
      ? publicTeamLogoUrl(logoPath)
      : "";
  const presetSrc = presetId ? getTeamLogoPath(presetId) : "";

  useEffect(() => {
    setImgBroken(false);
  }, [logoPath, logoId]);

  const box = size === "sm" ? "pm-avatar pm-avatar--sm pm-avatar--logo" : "pm-avatar pm-avatar--logo";

  const showCustom = Boolean(customUrl) && !imgBroken;
  const showPreset = !showCustom && Boolean(presetSrc) && !imgBroken;

  if (showCustom) {
    return (
      <div className={`${box} ${className}`.trim()} aria-hidden>
        <img
          src={customUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgBroken(true)}
        />
      </div>
    );
  }

  if (showPreset) {
    return (
      <div className={`${box} ${className}`.trim()} aria-hidden>
        <img
          src={presetSrc}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgBroken(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${box} ${className}`.trim()} aria-hidden>
      {initials(fallbackName)}
    </div>
  );
}
