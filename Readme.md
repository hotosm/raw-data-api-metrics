## Raw Data API Metrics

UI that can be used to fetch download metrics from API and display it in the chart

![image](https://github.com/user-attachments/assets/28ac405d-eb27-4f6d-a4a3-6bd1a0a5b82a)



### Metrics Definition

* **Total Overall Interactions Count**: Represents the total number of user actions performed including file downloads and other metadata queries.
* **Total Dataset Downloads Count**: Represents the total number of files retrieved (‘GET’ operations) from the service. This is the number of actual downloads performed by a user, it can have duplicates if the same link is accessed by the same user/ script multiple times.
* **Total Unique files Downloaded**: Represents the total number of unique files that were downloaded from a service. Same file can be downloaded multiple times, so this count comes after deduplication on the download count.
* **Total files Uploaded Count**: Answers how many files were generated and updated(in AWS S3) by the raw data API during this period of time. It is possible that new data may not be generated for existing files but user still be downloading old data. This helps to understand if the raw data API is actually generating new files or not
* **Total files Downloaded Size**: As the name suggests it’s the aggregate sum of file size downloaded by the users
* **Total files Uploaded Size**: Aggregate Sum of file size uploaded or updated by the raw data API to AWS S3
* **Unique Users**: Indicates the total number of distinct users that have interacted with files through our service, based on unique IP addresses. It is possible to have multiple downloads from the same IP, specially if downloads are being redirected using some server it might record only one server IP
* **Most Popular Files by Download**: Listing top 5 files with the highest number of downloads
* **Top User Locations by Download**: Tries to extract user’s country location (alpha 2 country codes) from requested IP. Unknown means IP couldn’t be located
* **Top Referrers**: AWS S3 server access logs by defaults try to catch the origin of request. If referrer identity is available in the API call’s request, then it is recorded. However this referrer information in the header is not available in all the API calls, so this metrics is not accurate and can be used only for generalization.
