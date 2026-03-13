git config core.hooksPath .githooks

git remote add -f uno-cursor-rules https://github.com/Simplistic-GE/uno-cursor-rules
git merge -s ours --no-commit --allow-unrelated-histories uno-cursor-rules/main
git read-tree --prefix= -u uno-cursor-rules/main
git commit -m "Subtree merged in uno-cursor-rules"
git subtree pull --prefix=.cursor/rules/ uno-cursor-rules main

pause