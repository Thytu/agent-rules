# Comments

## Review scope

Review only comment text added or materially changed by the pull request. Judge a contiguous comment block as one explanation, not isolated lines: an introductory behavior sentence is allowed when the rest of the block supplies the non-obvious reason or consequence. Machine-consumed annotations and public API documentation are not prose narration when they carry required contract information.

## Requirements

Default to no comment. Keep only a non-obvious reason, constraint, or invariant whose removal would cause misunderstanding. A useful comment connects the constraint to its consequence; mentioning what the code does does not invalidate a comment that explains why. A comment documenting a current external compatibility contract or deliberate operational exception is rationale, not a planning-artifact citation.

Never narrate the change, cite planning artifacts, restate syntax, preserve reviewer conversation, or write multi-paragraph implementation essays.
