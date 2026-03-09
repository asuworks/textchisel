#!/bin/sh
export PATH="$HOME/.qlty/bin:$PATH"
qlty fmt --trigger pre-commit --index-file="$GIT_INDEX_FILE"
