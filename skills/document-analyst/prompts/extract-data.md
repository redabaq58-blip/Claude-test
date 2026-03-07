# Data Extraction Prompt Template

```
Extract structured data from the following document:

{{document}}

Target data to extract:
{{extraction_targets}}

For each piece of data:
- Field: the data point name
- Value: extracted value (exact quote from document)
- Location: where in the document it was found
- Confidence: HIGH / MEDIUM / LOW
- Notes: any ambiguity or caveats

Output as a structured table or JSON as appropriate.
If a data point is not found, explicitly state "NOT FOUND" rather than leaving it blank.
```
