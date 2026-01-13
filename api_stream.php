<?php
// api_stream.php

require_once 'config.php';

// Disable buffering - AGGRESSIVE
@ini_set('zlib.output_compression', 0);
@ini_set('output_buffering', 'off');
@ini_set('implicit_flush', 1);
while (ob_get_level()) {
    ob_end_flush();
}
ob_implicit_flush(true);

header('Content-Type: text/event-stream; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no'); // Nginx
header('Access-Control-Allow-Origin: *');

// Get Input
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

if (!$input || !isset($input['message'])) {
    if (empty($inputJSON)) {
        http_response_code(400);
        echo "Error: No message provided.";
        exit;
    }
}

$userMessage = $input['message'] ?? '';

$payload = [
    'model' => OPENAI_MODEL,
    'messages' => [
        ['role' => 'system', 'content' => 'Bạn là một trợ lý ảo hữu ích, tên là Giám đốc Marketing ảo.'],
        ['role' => 'user', 'content' => $userMessage]
    ],
    'stream' => true
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.openai.com/v1/chat/completions');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . OPENAI_API_KEY
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

// Buffer for partial lines
$buffer = '';

curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($curl, $data) use (&$buffer) {
    // Append new data to buffer
    $buffer .= $data;

    // Process complete lines
    while (($pos = strpos($buffer, "\n")) !== false) {
        $line = substr($buffer, 0, $pos);
        $buffer = substr($buffer, $pos + 1);

        $line = trim($line);
        if (strpos($line, 'data: ') === 0) {
            $jsonStr = substr($line, 6); // Remove 'data: '
            if ($jsonStr === '[DONE]')
                continue;

            $json = json_decode($jsonStr, true);
            if (isset($json['choices'][0]['delta']['content'])) {
                echo $json['choices'][0]['delta']['content'];
                flush(); // Flush immediately
            }
        }
    }

    return strlen($data);
});

$result = curl_exec($ch);

if (curl_errno($ch)) {
    echo 'Error: ' . curl_error($ch);
}

curl_close($ch);
