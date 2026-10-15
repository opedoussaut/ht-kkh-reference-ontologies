# Knowledge qualification — public metadata structure

The atlas qualifies each resource with six questions, a general-purpose framework (often called 5W1H). It is used here
as a public metadata structure. No internal process status is imported.

| Question | Atlas interpretation | Fields |
| --- | --- | --- |
| **WHAT** | What is the resource and what does it represent? | `name`, `fullName`, `resourceType`, `kind`, `summary`, `knowledge` |
| **WHY** | Which engineering problems and industries can it support? | `industries`, `capabilities`, `useCases`, `engineeringUses` *(editorial)*, `limitations` |
| **WHO** | Who publishes, maintains or owns it? | `publisher`, `publisherType` |
| **HOW** | What formats, interfaces, licences and access mechanisms exist? | `formats`, `license` (incl. `reviewStatus`, `commercialReuse`), `links.distributions` |
| **WHEN** | Which version is documented and when was it reviewed? | `version`, `verification.checkedOn`, `editorialReview.reviewedOn` |
| **WHERE** | Where can the authoritative resource and its distributions be accessed? | `links.official`, `links.specification`, `links.repository`, `links.namespace`, `links.distributions` |

The detail page shows these as a compact qualification panel. Any unanswered question is displayed explicitly
("Not documented", "Not assessed") rather than hidden.

## Four separate concepts — never merged

| Concept | Question | Values | Who decides |
| --- | --- | --- | --- |
| **Maturity** | What kind of resource is it, in terms of standardisation and stability? | standard · stable · emerging · research · legacy · discontinued | Derived from the publisher's own status (criteria on the About page). |
| **Verification confidence** | How well has the atlas checked the stated facts? | verified · partially-verified · unverified | Atlas editors, against cited sources, on a stated date. |
| **Legal review** | Has anyone reviewed the licence for a given reuse? | `license.reviewStatus`: not-assessed (default) · reviewed. `commercialReuse`: unknown (default) · permitted · restricted · not-permitted | Only set after an actual review, citing the licence text. The atlas does not give legal advice. |
| **Suitability** | Is it suitable for *my* engineering application? | Not assessed by the atlas | Always the user's own engineering judgement. The atlas offers editorial *uses*, never suitability ratings. |

Rules:

- A working link does not raise verification confidence.
- "Standard" maturity does not imply verification, and "verified" does not imply suitability.
- No label implies certification, validation, endorsement or commercial-reuse rights.
- Internal organisational statuses (for example review or approval workflow states) are never shown as public labels.
