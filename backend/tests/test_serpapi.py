
from app.services.serpapi_service import search_google


def test_serpapi_connection():
    try:
        print("Testing SerpApi connection...")

        results = search_google(
            query="Python developer companies in India",
            num_results=5,
        )

        organic_results = results.get("organic_results", [])

        print("\nSerpApi connection successful!")
        print(f"Number of results received: {len(organic_results)}")

        for index, result in enumerate(organic_results, start=1):
            print(f"\n{index}. {result.get('title', 'No title')}")
            print(f"URL: {result.get('link', 'No URL')}")

    except Exception as exc:
        print("\nSerpApi test failed.")
        print(f"Error: {exc}")


if __name__ == "__main__":
    test_serpapi_connection()
