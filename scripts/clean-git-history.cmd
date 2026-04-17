@echo off
echo =====================================================
echo   Git History Cleaner
echo   Removes node_modules and .env from ALL commits
echo =====================================================
echo.
echo This will:
echo   1. Remove node_modules/ from entire git history
echo   2. Remove .env from entire git history
echo   3. Add .gitignore to prevent future accidents
echo   4. Force push cleaned repo to remote (GitHub)
echo.
echo WARNING: This rewrites git history permanently!
echo.
set /p confirm="Are you sure you want to continue? (y/n): "
if /i not "%confirm%"=="y" (
    echo Cancelled.
    pause
    exit /b
)

cd /d "%~dp0\.."

echo.
echo [1/6] Removing node_modules from all commits...
git filter-branch --force --index-filter "git rm -r --cached --ignore-unmatch node_modules" --prune-empty --tag-name-filter cat -- --all
if errorlevel 1 (
    echo ERROR: Failed to remove node_modules from history.
    pause
    exit /b 1
)

echo.
echo [2/6] Removing .env from all commits...
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all
if errorlevel 1 (
    echo ERROR: Failed to remove .env from history.
    pause
    exit /b 1
)

echo.
echo [3/6] Cleaning up git refs and garbage collecting...
git for-each-ref --format="delete %%(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo.
echo [4/6] Staging .gitignore...
git add .gitignore

echo.
echo [5/6] Committing .gitignore...
git commit -m "Add .gitignore to exclude node_modules and .env"

echo.
echo [6/6] Force pushing cleaned history to remote...
git push origin --force --all
if errorlevel 1 (
    echo ERROR: Force push failed. Check your network or permissions.
    pause
    exit /b 1
)

echo.
echo =====================================================
echo   DONE! Your git history is now clean.
echo   - node_modules removed from all commits
echo   - .env removed from all commits
echo   - .gitignore added to prevent future issues
echo   - Remote repository updated
echo =====================================================
echo.
pause
