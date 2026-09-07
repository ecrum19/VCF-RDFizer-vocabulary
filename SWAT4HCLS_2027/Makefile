.PHONY: all

all: paper-draft.pdf

paper-draft.pdf: main.tex sources.bib ceurart.cls cc-by.pdf ceur-ws-logo.pdf Makefile
	mkdir -p .build
	cp main.tex sources.bib ceurart.cls cc-by.pdf ceur-ws-logo.pdf .build/
	cd .build && latexmk -pdf -interaction=nonstopmode -halt-on-error -file-line-error main.tex
	cp .build/main.pdf paper-draft.pdf
