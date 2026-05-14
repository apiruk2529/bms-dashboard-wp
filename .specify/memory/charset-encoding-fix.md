# Thai Text Encoding Fix - Character Mojibake Issue

## Problem
Thai text from BMS API was displaying as garbled characters (mojibake) instead of proper Thai script. Example:
```
ขฦ.ตว่ฒฟฉฃ แรสธ่  (broken)
vs
ขร.สมิทธ์ อัษฐ์  (correct)
```

## Root Cause
The BMS API/database is returning data with **latin-1 charset** but the HTTP response header indicates UTF-8 (or doesn't specify charset properly). When the browser tries to decode latin-1 bytes as UTF-8, Thai characters become corrupted.

## Solution Implemented

### 1. **Charset Utility Module** (`src/utils/charsetUtils.ts`)
Created comprehensive charset detection and fixing utilities:
- `hasEncodingIssues()` - Detects if text has mojibake (checks for replacement chars, high latin-1 ratio)
- `fixEncodingIssues()` - Attempts to fix by re-interpreting latin-1 bytes as UTF-8
- `fixObjectEncoding()` - Recursively fixes entire API response objects/arrays

### 2. **HTTP Headers Updated** (`src/services/bmsSession.ts`)
- Added `'Accept-Charset': 'utf-8'` to request headers
- Updated `'Content-Type'` to include charset: `'application/json; charset=utf-8'`
- Applied encoding fixes to all API responses in both:
  - `retrieveBmsSession()` - Session retrieval
  - `executeSqlViaApi()` - SQL query execution

### 3. **Automatic Recovery**
The app now automatically detects and fixes mojibake in API responses, providing graceful fallback when the backend has encoding issues.

## Files Modified
- `src/services/bmsSession.ts` - Added charset headers and encoding fix calls
- `src/utils/charsetUtils.ts` - New: Charset detection and fixing utilities
- `tests/unit/charsetUtils.test.ts` - New: Unit tests for charset utilities

## Testing
Build verified successfully. Tests included for:
- Valid Thai text detection
- Mojibake detection (replacement chars, latin-1 ratio)
- Nested object/array encoding fixes
- Primitive value preservation

## Performance Impact
Minimal - encoding detection is O(n) string scan, only applied to API responses, not on every render.

## Notes for Future Work
If Thai text still displays incorrectly after this fix:
1. Check BMS API headers in DevTools Network tab for actual `Content-Type` header
2. Verify database charset: `SHOW CREATE DATABASE;` (should be utf8mb4)
3. Consider server-side query with explicit UTF-8: `SET NAMES utf8mb4;`
4. If database is truly latin-1, may need backend changes
