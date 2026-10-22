// schema.org Person for the prerendered <script type="application/ld+json"> (D12).

/** Builds the Person JSON-LD object from PROFILE. Pure and JSON-safe. */
export function buildPersonJsonLd(profile) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    email: 'mailto:' + profile.email,
    // Same string as <link rel="canonical"> (index.html: %SITE_URL%/).
    url: profile.site + '/',
    jobTitle: 'Full-stack developer',
    alumniOf: { '@type': 'CollegeOrUniversity', name: profile.education.school },
    sameAs: [profile.links.github, profile.links.linkedin, profile.links.instagram],
  }
}
