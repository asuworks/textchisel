#!/bin/sh
export PATH="$HOME/.qlty/bin:$PATH"
qlty check \
	--trigger pre-push \
	--upstream-from-pre-push \
	--no-formatters \
	--skip-errored-plugins
