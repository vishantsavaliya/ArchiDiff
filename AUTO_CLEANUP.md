# Auto-Cleanup Storage Management

## New Behavior ✅

Files are now **automatically cleaned up** to save storage and memory:

### Processing Flow

```
1. Upload PDFs/Images
   ↓
2. Convert → Upscale → Remove Text
   ↓
3. 🗑️ DELETE uploads folder (raw files not needed)
   ↓
4. 🗑️ DELETE intermediate files (converted/, upscaled.png)
   ↓
5. ✅ KEEP only final processed images (file1_final.png, file2_final.png)
   ↓
6. User edits with tools (SAM, Line Selector, Overlay)
   ↓
7. 🗑️ Auto-cleanup after 30 minutes OR when user leaves
```

## What Gets Deleted & When

### Immediately After Processing:

- ✅ **Uploads folder** (`uploads/<job-id>/`) - Raw PDFs/images
- ✅ **Converted PDFs** (`file1_converted/`, `file2_converted/`)
- ✅ **Upscaled intermediates** (`file1_upscaled.png`, `file2_upscaled.png`)

### What Stays for Editing:

- 📁 **Final images only** (`file1_final.png`, `file2_final.png`)
- These are used by SAM Remover, Line Selector, Overlay tools

### Cleanup Triggers:

1. **30 minutes of inactivity** - Automatic
2. **Click "Start Over"** - Immediate
3. **New upload starts** - Cleans old files
4. **Server restart** - Cleans all old files
5. **"Cleanup Old Files" button** - Manual cleanup

## Storage Savings

### Before:

```
processed/<job-id>/
  ├── file1.pdf              (5 MB)    ❌ Kept
  ├── file2.pdf              (5 MB)    ❌ Kept
  ├── file1_converted/       (10 MB)   ❌ Kept
  ├── file2_converted/       (10 MB)   ❌ Kept
  ├── file1_upscaled.png     (15 MB)   ❌ Kept
  ├── file2_upscaled.png     (15 MB)   ❌ Kept
  ├── file1_final.png        (15 MB)   ✅ Needed
  └── file2_final.png        (15 MB)   ✅ Needed
                             --------
Total: 90 MB per job
```

### After:

```
processed/<job-id>/
  ├── file1_final.png        (15 MB)   ✅ Kept
  └── file2_final.png        (15 MB)   ✅ Kept
                             --------
Total: 30 MB per job (67% reduction!)
```

## Benefits

### 1. Storage Efficiency

- **67% less disk space** per job
- Only keep what's needed for editing
- Automatic cleanup prevents accumulation

### 2. Memory Efficiency

- Fewer files to track in memory
- Faster file operations
- Prevents memory leaks from old jobs

### 3. Performance

- Less disk I/O
- Faster cleanup operations
- Quicker server restarts

## How It Works

### Backend (processing_api.py)

**After processing completes:**

```python
# Delete uploads folder (raw files)
upload_folder = UPLOAD_FOLDER / job_id
if upload_folder.exists():
    shutil.rmtree(upload_folder)
    print("✓ Deleted uploads folder")

# Delete intermediate files
for folder in ['file1_converted', 'file2_converted']:
    shutil.rmtree(job_output / folder)

for upscaled in [upscaled1_path, upscaled2_path]:
    upscaled.unlink()
```

**On every new upload:**

```python
def cleanup_old_uploads():
    # Delete ALL uploads (should already be gone)
    for folder in UPLOAD_FOLDER.iterdir():
        shutil.rmtree(folder)

    # Delete processed folders older than 30 min
    for folder in OUTPUT_FOLDER.iterdir():
        if folder_age > 1800:  # 30 minutes
            shutil.rmtree(folder)
```

### Frontend (Dashboard.tsx)

**Track user activity:**

```typescript
// Update timestamp on user interaction
useEffect(() => {
  const updateActivity = () => {
    localStorage.setItem("last_activity", Date.now().toString());
  };

  window.addEventListener("click", updateActivity);
  // ... other events
});
```

**Cleanup on exit:**

```typescript
const handleStartOver = () => {
  // Delete current job before leaving
  if (jobId) {
    axios.delete(`${PROCESSING_API}/cleanup/${jobId}`);
  }
  // Navigate away
};
```

## Manual Controls

### 1. Dashboard Button

Click **"🗑️ Cleanup Old Files"** to delete all old jobs (keeps current)

### 2. Emergency Script

```bash
cd backend
python3 cleanup_all.py --force
```

### 3. API Endpoint

```bash
# Clean all old files
curl -X POST http://localhost:5004/cleanup-all

# Clean specific job
curl -X DELETE http://localhost:5004/cleanup/<job-id>
```

## File Lifecycle Timeline

```
Time: 0m          Upload & Start Processing
      ↓
Time: 1-2m        Processing completes
                  ↓ Delete uploads & intermediates
      ↓
Time: 2-30m       User edits with tools
                  (files kept in processed/)
      ↓
Time: 30m+        Auto-cleanup removes processed/
                  OR
                  User clicks "Start Over" (immediate cleanup)
```

## Verification

Check what's kept after processing:

```bash
cd backend
tree processed/
```

Should see:

```
processed/
└── <job-id>/
    ├── file1_final.png
    └── file2_final.png
```

**No uploads/, no converted/, no upscaled intermediates!**

## Troubleshooting

### Files not cleaning up?

1. Check backend console for cleanup logs
2. Restart backend server
3. Run manual cleanup: `python3 cleanup_all.py --force`

### Need files longer than 30 minutes?

Edit `processing_api.py`:

```python
if folder_age > 7200:  # 2 hours instead of 30 min
```

### Want to keep intermediates?

Comment out the cleanup section in `process_files()`:

```python
# # Delete intermediate files
# for folder_name in ['file1_converted', 'file2_converted']:
#     ...
```

## Summary

✅ **Automatic cleanup** - No manual intervention needed  
✅ **67% storage savings** - Keep only final images  
✅ **Faster processing** - Less files to manage  
✅ **Memory efficient** - Prevents buildup  
✅ **Safe** - Current work always protected

**Action Required:** Restart backend to activate!

```bash
cd backend
python3 processing_api.py
```
