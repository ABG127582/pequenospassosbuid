import base64

# Read the HTML file
with open('pages/mapa-mental.html', 'r') as f:
    html_content = f.read()

# Find the start of the base64 string
start_str = 'data:image/png;base64,'
start_index = html_content.find(start_str)

if start_index == -1:
    print("Error: Could not find the base64 image data.")
    exit(1)

# Find the end of the base64 string
end_index = html_content.find('"', start_index)
if end_index == -1:
    print("Error: Could not find the end of the image data.")
    exit(1)

# Extract the base64 string
base64_data = html_content[start_index + len(start_str):end_index]

# Debugging: print length and last 50 chars
print(f"Length of extracted data: {len(base64_data)}")
print(f"Last 50 chars of extracted data: {base64_data[-50:]}")

# The error "cannot be 1 more than a multiple of 4" often means there is a single '=' padding character which is wrong.
# It should be '==' or '===' or none. Let's try to fix it.
if len(base64_data) % 4 == 1:
    print("Trying to fix padding...")
    base64_data += '=' * 3
elif len(base64_data) % 4 == 2:
    print("Trying to fix padding...")
    base64_data += '=='
elif len(base64_data) % 4 == 3:
    print("Trying to fix padding...")
    base64_data += '='


# Decode the base64 string and write to a file
try:
    image_data = base64.b64decode(base64_data, validate=True)
    with open('assets/mapa-mental.png', 'wb') as f:
        f.write(image_data)
    print("Image extracted and saved to assets/mapa-mental.png")
except Exception as e:
    print(f"Error decoding or saving image: {e}")
    exit(1)
