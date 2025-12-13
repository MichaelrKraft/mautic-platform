# Course Player Implementation - Week 2 Day 10-11

## Session Date: 2025-12-13

---

## Updated Analysis (After Additional Context)

### Key Discoveries from Codebase Review:

**Already Implemented (Better than expected!):**
- [x] `CoursePlayer.tsx` - Full video.js integration with 5-second progress saving
- [x] `CourseSidebar.tsx` - Module/lesson navigation with expand/collapse  
- [x] `ProgressTracker.tsx` - Progress display component
- [x] Enrollment API (`/api/courses/[id]/enroll/route.ts`) - Creates enrollment, awards 10 points
- [x] Progress API (`/api/lessons/[id]/progress/route.ts`) - 90% threshold, awards points
- [x] video.js already installed in package.json

**What's Actually Missing:**
1. **Learn page** (`/community/[slug]/courses/[id]/learn/page.tsx`) - Main orchestration page
2. **Course detail enrollment fix** - Replace placeholder with actual API call
3. **Enrollment check API** (`/api/courses/[id]/enrollment/route.ts`) - Check if user enrolled
4. **Working video URLs in seed data** - Current placeholders won't play

---

## Implementation Plan

### Task 1: Create Enrollment Check API
**File:** `/src/app/api/courses/[id]/enrollment/route.ts`

Purpose: Check if user is enrolled before allowing access to learn page
- [ ] GET endpoint returns enrollment if exists, 404 if not
- [ ] Include lesson progress in response

### Task 2: Update Seed Data with Working Videos
**File:** `/prisma/seed.ts`

- [ ] Replace placeholder URLs with real sample videos:
  - `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`
  - `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4`

### Task 3: Create Course Learn Page  
**File:** `/src/app/community/[slug]/courses/[id]/learn/page.tsx`

Features:
- [ ] Check enrollment on load, redirect if not enrolled
- [ ] Layout: Sidebar (25%) + Main content (75%) with mobile responsiveness
- [ ] URL query parameter for lesson selection (`?lesson=xxx`)
- [ ] Fetch course data with modules and lessons
- [ ] Track current lesson state
- [ ] Pass lesson progress to CourseSidebar for checkmarks
- [ ] Auto-select first lesson if none specified
- [ ] Handle lesson navigation
- [ ] Use hardcoded demo userId (with clear production upgrade comments)

### Task 4: Fix Course Detail Page Enrollment
**File:** `/src/app/community/[slug]/courses/[id]/page.tsx`

Changes:
- [ ] Replace placeholder `handleEnroll` with actual API call
- [ ] Use hardcoded demo userId for MVP
- [ ] Redirect to learn page on success
- [ ] Handle "already enrolled" case gracefully

### Task 5: Test Complete Flow
- [ ] Verify enrollment creates database record
- [ ] Verify learn page loads with first lesson
- [ ] Verify video plays correctly (with real sample video)
- [ ] Verify progress saves to database
- [ ] Verify 90% completion marks lesson done
- [ ] Verify sidebar shows completion checkmarks
- [ ] Verify overall course progress updates
- [ ] Test mobile responsive layout

---

## Technical Decisions

### 1. Authentication Approach (MVP)
Using hardcoded demo user for testing:
```typescript
// TODO: Replace with NextAuth.js session in production
// const session = await getServerSession();
// const userId = session?.user?.id;
const DEMO_USER_ID = 'demo-user-001';
```

### 2. Lesson Selection via Query Params
```typescript
const searchParams = useSearchParams();
const lessonId = searchParams.get('lesson');
const currentLessonId = lessonId || course.modules[0]?.lessons[0]?.id;
```

### 3. Mobile Responsive Layout
```tsx
<div className="flex flex-col lg:flex-row h-screen">
  <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r">
    <CourseSidebar />
  </div>
  <div className="flex-1 overflow-auto">
    <CoursePlayer />
  </div>
</div>
```

### 4. Edge Case: Division by Zero
```typescript
const calculateProgress = (totalLessons: number, completed: number) => {
  if (totalLessons === 0) return 0;
  return Math.round((completed / totalLessons) * 100);
};
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `/src/app/api/courses/[id]/enrollment/route.ts` | CREATE | Check enrollment status |
| `/src/app/community/[slug]/courses/[id]/learn/page.tsx` | CREATE | Main course player page |
| `/src/app/community/[slug]/courses/[id]/page.tsx` | MODIFY | Fix enrollment handler |
| `/prisma/seed.ts` | MODIFY | Add working video URLs |

## Existing Files to Reference (Don't Modify):
- `/src/components/courses/CoursePlayer.tsx` - Video player component
- `/src/components/courses/CourseSidebar.tsx` - Sidebar navigation
- `/src/components/courses/ProgressTracker.tsx` - Progress bar
- `/src/app/api/courses/[id]/enroll/route.ts` - Enrollment API
- `/src/app/api/lessons/[id]/progress/route.ts` - Progress API

---

## Success Criteria

When complete:
1. ✅ User can click "Enroll Now" on course detail page
2. ✅ Enrollment redirects to learn page with first lesson
3. ✅ Video plays with real sample video
4. ✅ Progress saves automatically every 5 seconds
5. ✅ Resuming course loads from last position
6. ✅ 90% watched marks lesson complete
7. ✅ Sidebar navigation shows all modules/lessons
8. ✅ Sidebar shows completion checkmarks
9. ✅ Clicking different lesson loads that lesson via URL
10. ✅ Overall progress percentage updates
11. ✅ Mobile responsive layout works
12. ✅ Non-enrolled users redirected to course detail page

---

## Review Section
*(To be filled after implementation)*

