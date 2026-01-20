# PDF Report Structure & Design Guide

## Report Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                      PAGE 1: COVER PAGE                         │
│                                                                 │
│                    [FULL LETTERHEAD BACKGROUND]                │
│                                                                 │
│                       SNAGGING REPORT                           │
│                       (28pt, black)                             │
│                                                                 │
│                        Project Name                            │
│                        (14pt, grey)                             │
│                                                                 │
│                    Client: [Client Name]                       │
│                    (11pt, black)                                │
│                                                                 │
│                                                                 │
│              Report Generated: [Date]                          │
│              (10pt, grey)                                       │
│                                                                 │
│                    ─────────────────────                        │
│                    Company Contact Footer                       │
│                    ─────────────────────                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Project Name ────────────────────────────────────── Page 2 of N  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    EXECUTIVE SUMMARY                            │
│                                                                 │
│  ■ Status Breakdown:                                           │
│    □ Open: 12 snags         [RED]                              │
│    □ In Progress: 5 snags   [ORANGE]                           │
│    □ Completed: 8 snags     [GREEN]                            │
│    □ Verified: 3 snags      [BLUE]                             │
│                                                                 │
│  ■ Priority Breakdown:                                         │
│    □ Critical: 2 snags      [RED]                              │
│    □ High: 4 snags          [ORANGE]                           │
│    □ Medium: 15 snags       [BLUE]                             │
│    □ Low: 7 snags           [GREEN]                            │
│                                                                 │
│  ■ Project Details:                                            │
│    Project: Office Renovation Phase 2                          │
│    Client: ABC Property Developers                             │
│    Project Number: PR-2024-001                                 │
│    Address: 123 Main Street, Cape Town                         │
│    ...                                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Project Name ────────────────────────────────────── Page 3 of N  │
├─────────────────────────────────────────────────────────────────┤
│                        SNAG LIST SUMMARY                        │
├─────────────────────────────────────────────────────────────────┤
│ #  │ Title                    │ Location  │ Status │ Priority  │
├────┼──────────────────────────┼───────────┼────────┼───────────┤
│ 1  │ Paint crack in ceiling   │ Office A  │ Open   │ HIGH      │
│ 2  │ Door latch broken        │ Hallway   │ Prog.  │ MEDIUM    │
│ 3  │ Water stain on wall      │ Bathroom  │ Open   │ CRITICAL  │
│ 4  │ Loose baseboard trim     │ Bedroom   │ Compl. │ LOW       │
│...                                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Project Name ────────────────────────────────────── Page 4 of N  │
├─────────────────────────────────────────────────────────────────┤
│                       SNAG DETAILS                              │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 1. Paint crack in ceiling                                │ │
│  │ [OPEN]  [HIGH]  Location: Office A              Due: TBD  │ │
│  │                                                           │ │
│  │ Description:                                             │ │
│  │ Long diagonal crack running across ceiling near corner,  │ │
│  │ approx 2 meters. Appears to be structural settlement.    │ │
│  │ Needs investigation and repair.                          │ │
│  │                                                           │ │
│  │ ┌────────────────┬────────────────┐                      │ │
│  │ │Location on     │ Photo 1:       │                      │ │
│  │ │Plan            │ Close-up of    │                      │ │
│  │ │[100x100 img]   │ crack [100x100]│                      │ │
│  │ └────────────────┴────────────────┘                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 2. Door latch broken                                      │ │
│  │ [IN PROGRESS]  [MEDIUM]  Location: Hallway  Due: 2024-02 │ │
│  │                                                           │ │
│  │ Description:                                             │ │
│  │ Bedroom door latch not closing properly. Spring         │ │
│  │ mechanism appears damaged.                              │ │
│  │                                                           │ │
│  │ ┌────────────────┬────────────────┐                      │ │
│  │ │Photo 1:        │ Photo 2:       │                      │ │
│  │ │Latch detail    │Open door showing│                     │ │
│  │ │[100x100 img]   │gap [100x100]   │                     │ │
│  │ └────────────────┴────────────────┘                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│                      ... more snag cards ...                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Project Name ────────────────────────────────────────── Final    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Report prepared by:                                            │
│                                                                 │
│ BPAS Architects & Engineers                                    │
│ Office F14, First Floor                                        │
│ Willowbridge Shopping Centre                                   │
│ 39 Carl Cronje Drive                                           │
│ Tygervalley, 7530                                              │
│                                                                 │
│ Tel: +27 (0) 21 914 5960                                       │
│ Email: info@bpas.co.za                                         │
│ Web: www.bpas.co.za                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Snag Card Anatomy

```
┌─────────────────────────────────────────────────────┐ ← Card with rounded corner
│ 1. Paint crack in ceiling                           │   border & light bg
├─────────────────────────────────────────────────────┤
│ [OPEN]  [HIGH]  Location: Office A   Due: 2024-02  │ ← Metadata row with badges
├─────────────────────────────────────────────────────┤
│ Description:                                         │ ← Clear label
│ Long diagonal crack running across ceiling near      │
│ corner, approx 2 meters. Appears to be structural   │   Multi-line description
│ settlement. Needs investigation and repair.          │   with proper wrapping
│                                                      │
├─────────────────────────────────────────────────────┤
│ Location on Plan    Photo 1: Crack Detail           │ ← Image labels
│ ┌──────────────┐   ┌──────────────┐                │
│ │              │   │              │                │   100pt height each
│ │  [100x100    │   │  [100x100    │                │   2-column layout
│ │   image]     │   │   image]     │                │   with 15pt gap
│ │              │   │              │                │
│ └──────────────┘   └──────────────┘                │
└─────────────────────────────────────────────────────┘

← 4pt border radius, 0.5pt stroke (#E2E8F0)
← 8pt padding all sides
← 15pt spacing between cards
```

---

## Color Palette

### Status Colors
```
Open          [■ #EF4444] - Red - Urgent, requires action
In Progress   [■ #F97316] - Orange - Active work
Completed     [■ #22C55E] - Green - Work done, awaiting verification
Verified      [■ #3B82F6] - Blue - Approved and signed off
```

### Priority Colors
```
Critical      [■ #EF4444] - Red - Must address immediately
High          [■ #F97316] - Orange - Important, schedule soon
Medium        [■ #3B82F6] - Blue - Schedule within normal timeframe
Low           [■ #22C55E] - Green - Nice to have, lower urgency
```

### Brand Colors
```
Brand Yellow  [■ #EBA000] - Table headers, accent elements
Brand Black   [■ #121212] - Titles, main text
Brand Grey    [■ #5A6061] - Body text, secondary information
Light Grey    [■ #6B7280] - Tertiary text, borders
```

---

## Header Styles

### Cover Page & Final Page
```
Full letterhead background image (1:1 page ratio)
Company logo at top
Contact information at bottom
Large centered titles
```

### Internal Pages (Slim Header)
```
┌─────────────────────────────────────────────────────────┐
│ Project Name ───────────────────── Page 3 of 15         │ ← 9pt grey
├─────────────────────────────────────────────────────────┤ ← 0.5pt line
│ Content starts here...                                  │
```

---

## Spacing & Margins

```
Page Margin (all sides):    40pt
Content area width:         520pt (on A4 portrait)

Snag Card:
  - Border radius:          4pt
  - Internal padding:       8pt
  - Spacing between cards:  15pt

Snag Card Content:
  - Title: 12pt font
  - Title line height:      14pt
  - Metadata row height:    12pt
  - Description spacing:    10pt between lines, +10pt before images
  - Image spacing:          15pt horizontal gap, 25pt vertical gap
  
Table:
  - Header height:          16pt
  - Row height:             14-18pt (auto)
  - Cell padding:           8pt (v), 6pt (h)
```

---

## Font Sizes & Hierarchy

```
Cover Page Title             28pt (bold, black)
Section Headers              16pt (bold, black)
Subsection Headers           12pt (bold, black)
Card Titles                  12pt (black)
Body Text / Table            9-10pt (grey/black)
Labels / Metadata            8-9pt (grey)
Badges                       8pt (white on color)

Line Height:                 1.4x font size (default)
```

---

## Image Sizing

```
Floor Plan (full page):
  - Orientation:            Landscape (A4)
  - Max width:              765pt (landscape width - margins)
  - Max height:             460pt (landscape height - margins)
  - Aspect ratio:           Maintained
  - Quality:                0.8 (80% JPEG quality)
  
Snag Photos:
  - Per card:               Max 2 photos shown
  - Arrangement:            2 columns
  - Width per image:        (520pt - 40pt margins - 15pt gap) / 2 = 232pt
  - Height:                 100pt (fixed)
  - Quality:                0.7 (70% JPEG quality)
  
Location Snippet:
  - Size:                   200x200px (canvas size)
  - Quality:                0.8 (80% JPEG quality)
  - Marker:                 12pt red circle with number
  - Scale:                  1.5x on floor plan for visibility
```

---

## Dynamic Sizing Example

**Scenario 1: Short snag with 1 photo**
```
Title:        50pt
Metadata:     12pt
Description:  20pt (2 lines)
Images:       100pt
Padding:      20pt
───────────────────
TOTAL:        202pt (fits 3-4 per page with 40pt margins)
```

**Scenario 2: Long snag with 3 photos (2 shown)**
```
Title:        50pt
Metadata:     12pt
Description:  60pt (6 lines)
Images:       150pt (2 rows)
Padding:      20pt
───────────────────
TOTAL:        292pt (fits 2 per page with 40pt margins)
```

**Scenario 3: No photos, no description**
```
Title:        50pt
Metadata:     12pt
Description:  0pt
Images:       0pt
Padding:      20pt
───────────────────
TOTAL:        82pt (fits 6-7 per page with 40pt margins)
```

---

## Table Structure (Snag List Summary)

```
┌────┬─────────────────────┬──────────┬────────┬──────────┬────────┐
│ #  │ Title               │ Location │ Status │ Priority │ Due    │
├────┼─────────────────────┼──────────┼────────┼──────────┼────────┤ ← Header row
│ 30 │ Width: 100pt        │ Width:   │ Width: │ Width:   │ Width: │
│    │ Halign: Left        │ 90pt     │ 50pt   │ 50pt     │ 60pt   │
│    │                     │ Halign:  │ Halign:│ Halign:  │ Halign:│
│    │                     │ Left     │ Center │ Center   │ Right  │
├────┴─────────────────────┴──────────┴────────┴──────────┴────────┤
│ Alternating row colors: white / #F8FAFC                         │
│ Color-coded cells: Status and Priority columns have bg colors   │
└────────────────────────────────────────────────────────────────┘
```

---

## Recommendations for Users

### Best Practices
1. **Snag Descriptions**: Keep under 150 characters for optimal spacing
2. **Photo Count**: Upload 1-2 photos per snag (more won't be shown)
3. **Location Names**: Use concise location names (max 20 characters)
4. **Dates**: Always set due dates for accountability
5. **Priority**: Use priority levels consistently

### Expected Report Length
- 10 snags:     4-6 pages
- 50 snags:     15-20 pages
- 100 snags:    25-35 pages
- 200 snags:    50-70 pages

*Actual page count varies based on image count and description length*

---

## Testing Checklist

- [ ] PDF generated successfully for test project
- [ ] Cover page displays with full letterhead
- [ ] Executive summary shows correct status/priority counts
- [ ] Snag list table renders without overlapping text
- [ ] Snag cards display with correct height based on content
- [ ] Images align side-by-side without gaps
- [ ] Floor plans show priority-colored markers
- [ ] Colors match brand guidelines
- [ ] No text wrapping issues in any section
- [ ] Final page displays company contact information
- [ ] Word report (.docx) generates with matching structure
- [ ] Report size is reasonable (not too many pages)
