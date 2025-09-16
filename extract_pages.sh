#!/bin/bash

# This script extracts page sections from index.html and creates separate files for them.

# The list of page keys to extract.
# Note: 'fisica' is already done, but it's harmless to run it again.
# Also, some pages are '.page-container' instead of '.page-section'.
pages=(
    "inicio"
    "fisica"
    "mental"
    "financeira"
    "familiar"
    "profissional"
    "social"
    "espiritual"
    "preventiva"
    "mapa-mental"
    "planejamento-diario"
    "tarefas"
    "leitura-guia-fisica"
    "leitura-guia-mental"
    "leitura-guia-financeira"
    "leitura-guia-familiar"
    "leitura-guia-espiritual"
    "alongamento"
    "food-alho"
    "food-azeite"
    "food-brocolis"
    "food-canela"
    "food-cenoura"
    "food-chaverde"
    "food-couveflor"
    "food-creatina"
    "food-curcuma"
    "food-gengibre"
    "food-laranja"
    "food-lentilha"
    "food-linhaca"
    "food-maca"
    "food-morango"
    "food-ovo"
    "food-pimenta"
    "food-shitake"
    "food-vinagremaca"
    "food-whey"
)

# The input file
input_file="index.html"

# Loop through the pages and extract them
for page in "${pages[@]}"; do
    echo "Extracting page: $page"
    # Use awk to find the block for the current page
    # It looks for the line with id="page-PAGE" and then prints until it finds the closing </div> of that block.
    # It uses a counter to handle nested divs.
    awk -v page_id="page-$page" '
    BEGIN { p=0 }
    $0 ~ "id=\"" page_id "\"" {
        p=1;
        level=0;
    }
    p {
        print;
        if (/<div/ && !/\/>/) level++;
        if (/<\/div>/) level--;
        if (level == 0 && p == 1 && $0 ~ /<\/div>/) p=0;
    }
    ' "$input_file" > "pages/$page.html"
    echo "Created pages/$page.html"
done

echo "Extraction complete."
