import json
from typing import Any, Dict, Type

from pydantic import BaseModel

from app.core.config import get_settings


def request_json(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 1200,
    response_model: Type[BaseModel] | None = None,
) -> Dict[str, Any]:
    settings = get_settings()
    provider = settings.llm_provider.lower()

    if provider == "none":
        return {}

    if provider == "openai":
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        input_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        if response_model and hasattr(client.responses, "parse"):
            response = client.responses.parse(
                model=settings.openai_model,
                input=input_messages,
                text_format=response_model,
            )
            parsed = getattr(response, "output_parsed", None)
            if parsed is not None:
                return parsed.model_dump()
            raw_text = response.output_text
        else:
            response = client.responses.create(
                model=settings.openai_model,
                input=input_messages,
                temperature=0.2,
            )
            raw_text = response.output_text
    elif provider == "anthropic":
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            temperature=0.2,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw_text = "".join(block.text for block in response.content if getattr(block, "type", "") == "text")
    else:
        return {}

    cleaned = raw_text.replace("```json", "").replace("```", "").strip()
    if response_model:
        return response_model.model_validate_json(cleaned).model_dump()
    return json.loads(cleaned)
