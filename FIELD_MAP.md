# AC Custom Field Reference

Complete dump from ActiveCampaign API (2026-04-13).

## Fields We Sync (FIELD_MAP)

### Lead Magnet Progress
| ID | Perstag | Type | Column | Notes |
|----|---------|------|--------|-------|
| 131 | DRINKING_QUIZ | radio | quiz_taken | "Taken" → true. Also check tag "takeitorleaveit-quiz" |
| 132 | MASTER_CLASS | radio | masterclass_taken | "Taken" → true. Also check tag "masterclass" |
| 148 | MASTERCLASS_CTA | text | masterclass_cta | Number — engagement count |

### LTO Purchasers
| ID | Perstag | Type | Column | Notes |
|----|---------|------|--------|-------|
| 136 | SMD | checkbox | smd_purchased | contains "yes" (AC stores "||Yes||") |
| 137 | RISE | checkbox | rise_purchased | contains "yes" |
| 138 | BUNDLE | checkbox | bundle_purchased | contains "yes" |

### Payment & Dates
| ID | Perstag | Type | Column | Notes |
|----|---------|------|--------|-------|
| 15 | AMOUNT_PAID | text | amount_paid | "$X,XXX.00" — TNC payment |
| 16 | DATETIMEPAID | datetime | date_paid | TNC date paid |
| 139 | MOST_RECENT_PURCHASE | date | most_recent_purchase | |
| 145 | DATE_PURCHASED | date | date_purchased | NEW |
| 146 | LAST_PRODUCT_PURCHASED | text | last_product_purchased | NEW |
| 69 | Y2_AMOUNT_PAID | text | y2_amount_paid | |
| 70 | Y2_DATE_PAID_24_HR_FORMAT | datetime | y2_date_paid | |
| 147 | Y2_PROGRAM_END_DATE | date | y2_program_end_date | NEW |

### Program Dates (CORRECTED)
| ID | Perstag | Type | Column | Notes |
|----|---------|------|--------|-------|
| 87 | START | date | program_start | Was incorrectly mapped to 89 |
| 88 | END | date | program_end | Was incorrectly mapped to 149 |
| 89 | ISO_START_DATE | datetime | iso_start_date | Embodiment track ISO date |
| 149 | PROGRAM_END_DATE_DATE_FIELD | date | program_end_date | Separate from END (88) |

### Embodiment Track
| ID | Perstag | Type | Column | Notes |
|----|---------|------|--------|-------|
| 98 | EMBODIMENT_AMOUNT_PAID | text | embodiment_amount_paid | NEW |
| 86 | FIRST_CALL_DATE | text | first_call_date | NEW |

### Attribution
| ID | Perstag | Type | Column | Notes |
|----|---------|------|--------|-------|
| 33 | LEAD_SOURCE | text | lead_source | |
| 44 | UTMSOURCE | text | utm_source | |
| 45 | SETTER | text | setter | |
| 36 | CLOSER | text | closer | |
| 90 | CALL_SCHEDULED_BY | text | call_scheduled_by | |

### Discovery Calls
| ID | Perstag | Type | Column | Notes |
|----|---------|------|--------|-------|
| 75 | CURRENT_DISCOVERY_CALL | datetime | current_discovery_call | |
| 32 | MOST_RECENT_DISCOVERY_CALL | text | most_recent_discovery_call | |
| 35 | CONFIRMED_DISCOVERY_CALL | text | confirmed_discovery_call | |

### Status & Progress
| ID | Perstag | Type | Column | Notes |
|----|---------|------|--------|-------|
| 74 | OPT_IN_STATUS | dropdown | opt_in_status | |
| 95 | PODCAST_ONLY | text | podcast_only | |
| 99 | IS_COACHING_TRACK | text | is_coaching_track | |
| 106 | INDEPENDENT_STUDY | text | independent_study | |
| 127 | PROGRESS | dropdown | progress | NEW |
| 150 | EMAIL_STAGE | text | email_stage | NEW |

### Booking Form (Book A Call)
| ID | Perstag | Type | Column | Notes |
|----|---------|------|--------|-------|
| 121 | WHY_NOW | textarea | why_now | NEW — MOFU: has value = completed form |
| 122 | COMMUNITY_PREFERENCE | dropdown | community_preference | |
| 123 | INVESTMENT_READINESS | dropdown | investment_readiness | |
| 124 | DECISION_MAKER | dropdown | decision_maker | |
| 125 | ANYTHING_ELSE | textarea | anything_else | |

### Quiz Responses
| ID | Perstag | Type | Column | Notes |
|----|---------|------|--------|-------|
| 126 | TYPE_OF_DRINKER | text | type_of_drinker | |
| 111 | WHAT_HAPPENS_WHEN... | checkbox | quiz_night_off | |
| 112 | WHAT_DOES_YOUR_HEAD... | checkbox | quiz_head_sounds | |
| 113 | WHEN_DO_YOU_MOST... | checkbox | quiz_first_drink | |
| 114 | WHATS_THE_CONVERSATION... | checkbox | quiz_conversation | |
| 115 | WHEN_YOUVE_TRIED... | dropdown | quiz_cut_back | |
| 116 | WHICH_OF_THESE... | dropdown | quiz_where_are_you | |
| 117 | WHAT_WORRIES_YOU... | dropdown | quiz_worries | |
| 118 | WHAT_SOUNDS_APPEALING... | checkbox | quiz_appealing | |

### Location
| ID | Perstag | Type | Column | Notes |
|----|---------|------|--------|-------|
| 42 | COUNTRY | text | country | NEW |

---

## All AC Fields (complete dump)

```
ID    | PERSTAG                              | TYPE         | TITLE
------|--------------------------------------|--------------|------
2     | FEMALE                               | text         | Female?
3     | HAVE_YOU_LISTENED...                 | text         | Have you listened to the podcast
4     | PLEASE_DESCRIBE...                   | text         | Current drinking habits
6     | WHAT_IS_YOUR_GOAL...                 | text         | Goal with alcohol
8     | IF_COLLEENS_COACHING...              | text         | Ready to commit
9     | CAN_YOU_COMMIT...                    | text         | Present during zoom
15    | AMOUNT_PAID                          | text         | Amount Paid
16    | DATETIMEPAID                         | datetime     | Date Paid
17    | DATE_FORMATTED_FOR_EMAILS            | text         | Purchase Date Formatted
18    | PROGRAM_END_DATE_FORMATTED...        | text         | Program End Formatted
25    | ADDRESS                              | text         | Address Line1
26    | ACCOUNTABILITY_GROUP                 | text         | Accountability group
27    | LAST_ACTIVITY_FROM_ONTRAPORT         | date         | Last Activity
30    | INTERESTED_IN_HOSTING...             | text         | Hosting group interest
32    | MOST_RECENT_DISCOVERY_CALL           | text         | Most Recent Discovery Call
33    | LEAD_SOURCE                          | text         | Lead Source
34    | PERSONAL_CONTACT_SETTER_NEW_LEAD     | dropdown     | Setter: Personal Contact
35    | CONFIRMED_DISCOVERY_CALL             | text         | Confirmed Discovery call
36    | CLOSER                               | text         | Closer
37    | PRE_DISCOVERY_CALL_FEED              | text         | Pre Discovery Call Feed
38-41 | ADDRESS_LINE2/CITY/STATE/ZIPCODE     | text         | Address fields
42    | COUNTRY                              | text         | Country
44    | UTMSOURCE                            | text         | utm_source
45    | SETTER                               | text         | Setter
46    | DISCORD_INVITE                       | text         | Discord Invite
48-53 | Various personalization fields       | text         | Personalization
56    | MONDAY_AFTER                         | date         | Monday After
62    | CONFIRMER                            | text         | confirmer
63    | SECONDARY_EMAIL                      | text         | secondary email
64-65 | DISCORD_USERNAME/ID                  | text         | Discord
66    | WHY_SHOULD_YOU_GET_A_SPOT            | text         | Why spot
67    | SUPPORT_SUCCESSION_AUTOMATION_DATE   | datetime     | Support date
68    | TNC_DOCUSIGN_LINK                    | text         | DocuSign link
69    | Y2_AMOUNT_PAID                       | text         | Y2 Amount Paid
70    | Y2_DATE_PAID_24_HR_FORMAT            | datetime     | Y2 Date Paid
71-72 | Y2 formatted dates                  | text         | Y2 formatted
73    | SALESMSG_INBOX_ID                    | text         | SalesMsg ID
74    | OPT_IN_STATUS                        | dropdown     | Opt-in status
75    | CURRENT_DISCOVERY_CALL               | datetime     | Current Discovery Call
77    | 24HR_REMINDER                        | datetime     | 24hr reminder
80    | WORKBOOK_ORDERED                     | text         | Workbook
81    | DISCOUNT                             | text         | discount
82    | ONBOARDING_ASANA_TASK_ID             | text         | Asana task
83    | SIGNWELL_IDENTIFIER                  | text         | SignWell
84    | ONBOARDING_FEED_LINK                 | text         | Feed link
86    | FIRST_CALL_DATE                      | text         | First Call Date
87    | START                                | date         | Start
88    | END                                  | date         | End
89    | ISO_START_DATE                       | datetime     | iso start date
90    | CALL_SCHEDULED_BY                    | text         | Call scheduled by
91    | CALENDLY_API_KEY                     | text         | Calendly API Key
92    | ZOOM_LINK_URL                        | text         | zoom link
93    | CANCEL_LINK                          | text         | Cancel Link
94    | RESCHEDULELINK                       | text         | Reschedule Link
95    | PODCAST_ONLY                         | text         | Podcast Only?
96    | PAYMENT_PLAN_YN                      | text         | Payment plan
97    | PAYMENT_AVENUE                       | text         | payment avenue
98    | EMBODIMENT_AMOUNT_PAID               | text         | Embodiment Amount Paid
99    | IS_COACHING_TRACK                    | text         | Is Coaching Track
100   | APP_PASSWORD_LINK                    | text         | App Password Link
101   | EVENT_UUID                           | text         | Event UUID
102   | FANCY_DATE                           | text         | Fancy Date
103   | SIGNED_AGREEMENT                     | text         | signed agreement
106   | INDEPENDENT_STUDY                    | text         | Independent Study
107   | APP_EMAIL                            | text         | App email
108   | APP_PASSWORD                         | text         | App password
111-118 | Quiz response fields              | various      | Quiz answers
119   | TIME_ENERGY_COMMITMENT               | dropdown     | Time commitment
120   | EMOTIONAL_READINESS                  | dropdown     | Emotional readiness
121   | WHY_NOW                              | textarea     | WHY NOW
122-125 | Booking form fields               | various      | Form answers
126   | TYPE_OF_DRINKER                      | text         | Type Of Drinker
127   | PROGRESS                             | dropdown     | Progress
131   | DRINKING_QUIZ                        | radio        | Drinking Quiz
132   | MASTER_CLASS                         | radio        | Master Class
136-138 | SMD/RISE/BUNDLE                    | checkbox     | LTO purchases
139   | MOST_RECENT_PURCHASE                 | date         | Most recent Purchase
141   | 30_DAY_AFTER_PURCHASE                | date         | 30 Day After
142   | WEBSITE_ENGAGEMENT                   | text         | Website Engagement
143   | OPENREADS_EMAIL                      | text         | Email opens
144   | CLICKS_A_LINK                        | text         | Link clicks
145   | DATE_PURCHASED                       | date         | Date Purchased
146   | LAST_PRODUCT_PURCHASED               | text         | Last Product
147   | Y2_PROGRAM_END_DATE                  | date         | Y2 End Date
148   | MASTERCLASS_CTA                      | text         | Masterclass CTA
149   | PROGRAM_END_DATE_DATE_FIELD          | date         | Program End Date
150   | EMAIL_STAGE                          | text         | Email Stage
151   | BOOKING_ASSISTANCE                   | radio        | Booking Assistance
152   | NEWSLETTER_CONSENT                   | text         | Newsletter Consent
```
