// pages/api/parseReceipt.js
import { vision } from '@google-cloud/vision';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { imageData } = req.body;

    try {
      // Create a Vision API client
      const client = new vision.ImageAnnotatorClient();

      // Create an image object
      const image = {
        content: imageData,
      };

      // Perform text detection
      const [response] = await client.textDetection(image);
      const texts = response.textAnnotations;

      // Parse the detected text to extract grocery item information
      const groceryItems = parseGroceryItems(texts);

      res.status(200).json({ groceryItems });
    } catch (error) {
      console.error('Error parsing receipt:', error);
      res.status(500).json({ error: 'Failed to parse receipt' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Function to parse the detected text and extract grocery item information
const parseGroceryItems = (texts) => {
    const groceryItems = [];

    // Regular expressions for matching item name, quantity, unit, price per, and total price
    const itemNameRegex = /^(.+?)\s*(?=\d)/;
    const quantityRegex = /(\d+(?:\.\d+)?)\s*(\w+)/;
    const pricePerRegex = /\$(\d+\.\d{2})/;
    const totalPriceRegex = /\$(\d+\.\d{2})$/;
  
    // Iterate through the detected text annotations
    for (const text of texts) {
      const description = text.description.trim();
  
      // Skip empty lines or irrelevant text
      if (!description) continue;
  
      // Match item name
      const itemNameMatch = description.match(itemNameRegex);
      const itemName = itemNameMatch ? itemNameMatch[1].trim() : '';
  
      // Match quantity and unit
      const quantityMatch = description.match(quantityRegex);
      const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : 1;
      const unit = quantityMatch ? quantityMatch[2] : '';
  
      // Match price per
      const pricePerMatch = description.match(pricePerRegex);
      const pricePer = pricePerMatch ? parseFloat(pricePerMatch[1]) : 0;
  
      // Match total price
      const totalPriceMatch = description.match(totalPriceRegex);
      const totalPrice = totalPriceMatch ? parseFloat(totalPriceMatch[1]) : 0;
  
      // Skip if item name is missing
      if (!itemName) continue;
  
      // Create a grocery item object
      const groceryItem = {
        item_name: itemName,
        quantity,
        unit,
        price: pricePer,
        total: totalPrice,
      };
  
      groceryItems.push(groceryItem);
    }
  
    return groceryItems;
};