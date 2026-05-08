import logging
import asyncio
from huggingface_hub import AsyncInferenceClient
from config import settings

logger = logging.getLogger(__name__)


class LLMRepository:
    """
    Repository layer — the ONLY class that communicates with HuggingFace.
    Follows the Repository Layer pattern from the project architecture.
    Returns raw AI text for the service layer to parse.
    """

    def __init__(self):
        self.client = AsyncInferenceClient(
            provider=settings.MODEL_PROVIDER,
            api_key=settings.HF_TOKEN,
        )

    async def call_gemma(self, prompt: str) -> str:
        """
        Calls Gemma 4 via HuggingFace Inference API with novita provider.
        Returns raw text response. Retries once on 429 rate limit.
        Returns empty string on any failure — caller handles fallback.
        """
        max_retries = 2
        for attempt in range(max_retries):
            try:
                response = await self.client.chat.completions.create(
                    model=settings.MODEL_ID,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are an expert software team analyst. "
                                "Always respond in the exact format requested. "
                                "Never add markdown fences, code blocks, or extra text."
                            )
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    max_tokens=300,
                    temperature=0.4,
                )

                raw = response.choices[0].message.content.strip()
                logger.info(f"[LLMRepository] Gemma returned {len(raw)} chars")
                return raw

            except Exception as e:
                error_str = str(e)
                if "429" in error_str and attempt < max_retries - 1:
                    wait_time = 2 ** (attempt + 1)  # 2s, 4s
                    logger.warning(f"[LLMRepository] Rate limited, retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
                logger.error(f"[LLMRepository] Gemma call failed: {e}. Will fall back to defaults.")
                return ""
