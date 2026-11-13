export const en = {
  navigation: {
    converter: "Converter",
    about: "About",
    privacy: "Privacy",
    label: "Main navigation",
  },
  language: {
    label: "Language",
    english: "English",
    polish: "Polski",
  },
  common: {
    convert: "Convert",
    converting: "Converting",
    loadingPage: "Loading page...",
    unknown: "unknown",
  },
  validation: {
    quality: "Quality must be between 1 and 100.",
  },
  errors: {
    "conversion-failed": "The file could not be converted. Please try again.",
    "invalid-response":
      "The application returned an unexpected response. Please try again.",
    "download-failed":
      "The converted file could not be downloaded. Please try again.",
    "tool-unavailable":
      "This conversion is currently unavailable. Please try again later.",
    "invalid-settings":
      "These settings cannot fit the file on the selected page. Try A3 landscape.",
    "service-busy": "The conversion service is busy. Please try again shortly.",
    unexpected:
      "Something went wrong. Use the navigation to open another page, or reload this page to try again.",
  },
  upload: {
    label: "Upload File",
    choose: "Choose File",
    dragHint: "or drag & drop your file here",
    maxSize: "Maximum file size: {{size}} MB.",
    viewConversions: "View supported conversions",
    unsupported: "Unsupported file format. Supported formats: {{formats}}.",
    tooLarge: "File is too large. Maximum size is {{size}} MB.",
    singleFileOnly: "Select one file at a time.",
  },
  converter: {
    preview: "1. File preview",
    remove: "Remove file",
    preparing: "Preparing preview...",
    uploadFirst: "Please upload a file first.",
  },
  options: {
    title: "2. Convert this file",
    description: "Choose an output format.",
    available: "Available conversion formats",
    noOptions: "Upload a file to see available conversions.",
    settings: "Conversion settings",
    choose: "Choose an output format to configure conversion.",
    orientation: "Orientation",
    portrait: "Portrait",
    landscape: "Landscape",
    pageSize: "Page size",
    quality: "Quality",
    transparent: "Replace transparent areas with",
  },
  download: {
    title: "Converted file",
    complete: "Conversion complete",
    file: "Download file",
    all: "Save all as ZIP",
    archiveActions: "Save ZIP archive",
    preparing: "Preparing archive...",
    files: "Converted files",
    page: "Page {{index}}",
    save: "Save",
    saveAs: "Save as…",
    saved: "Saved “{{fileName}}”",
    showInFolder: "Show in folder",
    closeNotification: "Dismiss notification",
    folderError: "Could not show the saved file in its folder.",
    saveErrors: {
      "disk-full": "Not enough disk space. Free up space or use “Save as”.",
      "permission-denied":
        "Permission to save was denied. Use “Save as” and choose another folder.",
      "save-failed": "Could not save the file. Try again or use “Save as”.",
    },
  },
  preview: {
    expand: "Expand preview",
    close: "Close preview",
    label: "File preview",
    pdf: "PDF Preview",
    unavailable: "Preview not available for this file type",
    unavailableDescription:
      "This format can still be converted when an option is available.",
    type: "Type: {{type}}",
    imageError: "Failed to load image preview",
    imageAlt: "Preview",
    textLoading: "Loading text content...",
    textError: "Failed to load file content",
    wordLoading: "Loading DOCX content...",
    wordError: "Failed to render DOCX content",
    csvLoading: "Loading CSV content",
    csvError: "Failed to load CSV content",
    csvEmpty: "CSV file is empty",
    xlsxLoading: "Loading XLSX content...",
    xlsxError: "Failed to load XLSX content",
    sheet: "Sheet",
    sheets: "Sheets",
    allSheets: "All sheets",
    sheetEmpty: "This sheet is empty.",
    showingRows: "Showing first {{shown}} of {{total}} rows.",
    dependency:
      "If this sheet depends on formulas or charts from other sheets, choose All sheets.",
    charts:
      "Charts are not shown in this preview. To view them, convert the file to PDF.",
    pptxLoading: "Loading PPTX content...",
    pptxError: "Failed to render PowerPoint presentation.",
    slideAlt: "PowerPoint slide {{index}}",
  },
  about: {
    authorTitle: "Meet the developer",
    authorText: "I'm Jarosław Baumgart, the developer of EasyConvert. Explore my projects on GitHub. Thanks for using the app and sharing your feedback!",
    authorGithub: "My GitHub",
    authorSupport: "Buy me a coffee — coming soon",
    eyebrow: "EasyConvert",
    title: "About the application",
    lead: "Convert common images, documents, spreadsheets, presentations, and text files in a few clear, uncluttered steps.",
    open: "Open converter",
    howTitle: "How it works",
    step1: "Select one file, up to 10 MB.",
    step2: "Choose one of the available conversion options.",
    step3: "Set page or image options when they are available.",
    step4: "Convert the file and save the result.",
    conversionsTitle: "Supported conversions",
    conversionsText:
      "The available options depend on the selected file. The application checks the file locally before conversion starts.",
    previewsTitle: "Previews",
    previewsText:
      "Images, PDFs, text files, CSV files, DOCX documents, XLSX workbooks, and PPTX presentations can be previewed before conversion. For XLSX, you can preview one sheet or all sheets.",
    settingsTitle: "Conversion settings",
    setting1: "PNG to JPG: image quality and background color.",
    setting2: "JPG, TXT, and CSV to PDF: A4 or A3, portrait or landscape.",
    setting3:
      "XLSX to PDF: one sheet or all sheets, page size, orientation, and fit-to-page output.",
    filesTitle: "Files and results",
    filesText:
      "Files are processed locally on your computer. Save writes results to the EasyConvert Output folder on your Desktop. Save as lets you choose a folder and file name. Multiple results can be saved as a ZIP archive. See the <privacyLink>privacy page</privacyLink> for details about temporary files.",
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy",
    lead: "Files are used only for the conversion you request. The app does not require an account or keep a personal conversion history.",
    processingTitle: "What is processed",
    processingText:
      "The application reads the selected file and conversion settings locally. Files are not uploaded to a conversion server. DOCX, XLSX, and PPTX conversion uses LibreOffice on your computer.",
    storageTitle: "How long files are kept",
    storage1:
      "The application creates a temporary copy of the selected file for previews and conversion. Your original file stays unchanged. The application attempts to delete the copy when you clear or replace the selection, or close the window.",
    storage2:
      "XLSX conversion can create a temporary workbook. It is deleted when processing ends.",
    storage3:
      "Generated files are stored in the system temporary folder. Save results you want to keep before clearing the selection or closing the application.",
    storage4:
      "Clearing the selection removes previews and access to the current results, but does not delete saved exports. Temporary conversion results are not automatically deleted yet. Some temporary files may also remain after an error or an unexpected application exit.",
    sensitiveTitle: "Sensitive files",
    sensitiveText:
      "Only process files you are allowed to use. Saved exports and any remaining temporary files stay on your computer. Keep this in mind when working with sensitive documents.",
    back: "Back to converter",
  },
  notFound: {
    title: "Page Not Found",
  },
} as const;
