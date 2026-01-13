<?php
// config.php

// OpenAI API Key
// Note: In production, consider using environment variables (.env) or a secure secrets manager.
define('OPENAI_API_KEY', getenv("OPENAI_API_KEY"));

// OpenAI Model
define('OPENAI_MODEL', 'gpt-4o');
