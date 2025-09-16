#!/bin/bash

# This script removes the footer section from all HTML files in the pages directory.

for file in pages/*.html; do
    echo "Processing $file"
    # Use sed to delete the block of lines from <footer> to </footer>
    sed -i '/<footer>/,/<\/footer>/d' "$file"
done

echo "Footer removal complete."
