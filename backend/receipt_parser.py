def parse_receipt(receipt_text, fridge_items):
    # Split text into lines and process each line
    lines = receipt_text.strip().split('\n')
    
    # Clean and normalize each line
    def clean_line(line):
        # Remove special characters and numbers, convert to lowercase
        cleaned = ''.join(char for char in line if char.isalpha() or char.isspace())
        return ' '.join(cleaned.lower().split())  # Normalize whitespace
        
    cleaned_lines = [clean_line(line) for line in lines if clean_line(line)]  # Remove empty lines
    
    # Get all unique fridge item names
    fridge_item_names = {item.name.lower() for item in fridge_items}
    
    matched_items = set()  # Changed to set since we're only tracking existence
    unmatched_items = []  # Track unmatched items
    
    # Process each line
    for line in cleaned_lines:
        if not line:  # Skip empty lines
            continue
            
        matched = False
        
        # First try exact match
        if line in fridge_item_names:
            matched_items.add(line)
            matched = True
            continue
        
        # Try partial matches for multi-word items
        for fridge_item_name in fridge_item_names:
            # Check if fridge item words are contained in the line
            fridge_item_words = set(fridge_item_name.split())
            line_words = set(line.split())
            
            if fridge_item_words.issubset(line_words):
                matched_items.add(fridge_item_name)
                matched = True
                break
                
        # If no match found and reasonable length (prevent junk entries)
        if not matched and len(line.split()) <= 3:
            unmatched_items.append(line)
            
    return list(matched_items), unmatched_items