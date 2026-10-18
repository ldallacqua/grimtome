//! Developer CLI: runs the same tooltip reader as the app on an image file and
//! prints the OCR result as JSON (used to record `tests/fixtures/ocr`).
//!
//! ```text
//! grimtome-ocr <image.png> [language-tag]
//! ```

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let Some(path) = args.get(1) else {
        eprintln!("usage: grimtome-ocr <image> [language-tag]");
        std::process::exit(1);
    };
    let bytes = std::fs::read(path).unwrap_or_else(|e| {
        eprintln!("cannot read {path}: {e}");
        std::process::exit(1);
    });
    match grimtome_lib::scan::read_image(&bytes, args.get(2).map(String::as_str)) {
        Ok(result) => println!("{}", serde_json::to_string_pretty(&result).expect("serializable")),
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(2);
        }
    }
}
